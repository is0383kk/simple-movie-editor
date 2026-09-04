// ============================================================================
// FFmpeg 実行器
// - spawn で ffmpeg を起動（引数配列渡し＝シェル非経由でパスの日本語/スペース安全）
// - stderr の time= を解析して進捗を算出しコールバックへ通知
// - clip / trim / merge の書き出しを統括（複数ステップの orchestration・一時ファイル管理）
// ============================================================================
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { ffmpegPath } from './paths'
import { probeVideo, isUniform } from './probe'
import {
  buildClipEncodeArgs,
  buildTrimArgs,
  buildConcatDemuxerArgs,
  buildNormalizeArgs
} from './commandBuilder'
import type { ClipRequest, TrimRequest, MergeRequest } from '@shared/types'

/** 進捗通知コールバック（percent: 0-100 または null） */
export type ProgressCb = (percent: number | null, message?: string) => void

/** ffmpeg 実行の 1 ステップ */
interface Step {
  args: string[]
  /** このステップで生成される出力のおおよその長さ（秒）。進捗按分に使用 */
  expectedDuration: number
}

const TIME_RE = /time=(\d+):(\d+):([\d.]+)/

/** stderr 行から time=HH:MM:SS.xx を秒に変換。無ければ null */
function parseTimeSeconds(chunk: string): number | null {
  const m = chunk.match(TIME_RE)
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  const s = Number(m[3])
  return h * 3600 + mm * 60 + s
}

/**
 * 1 回の ffmpeg 実行。stderr を監視して onLocalTime(秒) を呼ぶ。
 * 終了コード 0 以外は stderr 末尾を含めて reject。
 */
function runFfmpeg(args: string[], onLocalTime: (sec: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true })
    let stderrTail = ''

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      // 直近のエラー内容を保持（末尾 4000 文字）
      stderrTail = (stderrTail + text).slice(-4000)
      const sec = parseTimeSeconds(text)
      if (sec !== null) onLocalTime(sec)
    })

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg の起動に失敗しました: ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(summarizeFfmpegError(stderrTail)))
      }
    })
  })
}

/** ffmpeg の stderr からユーザー向けの簡潔なエラーメッセージを作る */
function summarizeFfmpegError(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  // それらしいエラー行を優先的に拾う
  const meaningful = lines.filter(
    (l) => /error|invalid|no such|permission|denied|failed|not found/i.test(l)
  )
  const picked = (meaningful.length > 0 ? meaningful : lines).slice(-3).join(' / ')
  return `FFmpeg の処理に失敗しました。${picked || ''}`.trim()
}

/**
 * 複数ステップを順番に実行し、全体進捗を通知する。
 * 全体進捗 = (完了済みステップの合計長 + 現ステップの経過時間) / 全ステップ合計長
 */
async function runSteps(steps: Step[], progress: ProgressCb): Promise<void> {
  const grandTotal = steps.reduce((sum, s) => sum + Math.max(s.expectedDuration, 0), 0)
  let base = 0
  for (const step of steps) {
    await runFfmpeg(step.args, (localSec) => {
      if (grandTotal > 0) {
        const percent = Math.min(100, Math.round(((base + localSec) / grandTotal) * 100))
        progress(percent)
      } else {
        progress(null)
      }
    })
    base += Math.max(step.expectedDuration, 0)
  }
  progress(100)
}

/** 一時作業ディレクトリを作成 */
async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `sve-${randomUUID()}`)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/** concat demuxer 用のリストファイルを書き出す。パス内の ' を安全にエスケープ */
async function writeConcatList(dir: string, files: string[]): Promise<string> {
  const listPath = join(dir, 'concat_list.txt')
  const body = files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
  await fs.writeFile(listPath, body, 'utf8')
  return listPath
}

// ---------------------------------------------------------------------------
// クリップ切り出し: 指定範囲をフレーム精度で切り出す（再エンコード）
// ---------------------------------------------------------------------------
export async function exportClip(req: ClipRequest, progress: ProgressCb): Promise<{ note?: string }> {
  const duration = req.end - req.start
  await runSteps(
    [{ args: buildClipEncodeArgs(req.input, req.output, req.start, req.end), expectedDuration: duration }],
    progress
  )
  return {}
}

// ---------------------------------------------------------------------------
// 範囲削除: 前後を連結（filter_complex 再エンコード）。音声有無を probe で判定
// ---------------------------------------------------------------------------
export async function exportTrim(req: TrimRequest, progress: ProgressCb): Promise<{ note?: string }> {
  const info = await probeVideo(req.input)
  const hasAudio = info.audioCodec !== null
  const outputDuration = Math.max(0, info.duration - (req.end - req.start))
  await runSteps(
    [{ args: buildTrimArgs(req.input, req.output, req.start, req.end, hasAudio), expectedDuration: outputDuration }],
    progress
  )
  return {}
}

// ---------------------------------------------------------------------------
// 結合: 仕様一致なら concat demuxer copy、差異ありなら正規化してから結合
// ---------------------------------------------------------------------------
export async function exportMerge(req: MergeRequest, progress: ProgressCb): Promise<{ note?: string }> {
  const infos = await Promise.all(req.inputs.map((p) => probeVideo(p)))
  const tempDir = await makeTempDir()

  try {
    if (isUniform(infos)) {
      // 高速パス: そのまま無劣化で連結
      const listPath = await writeConcatList(tempDir, req.inputs)
      const totalDuration = infos.reduce((s, i) => s + i.duration, 0)
      await runSteps([{ args: buildConcatDemuxerArgs(listPath, req.output, true), expectedDuration: totalDuration }], progress)
      return {}
    }

    // フォールバック: 共通仕様へ正規化してから連結（再エンコード）
    progress(0, '動画の仕様が異なるため、揃えてから結合しています…')

    // 目標仕様は先頭動画に合わせる（fps は最小 1 を保証）
    const target = infos[0]
    const targetFps = target.fps > 0 ? target.fps : 30

    const normalized: string[] = []
    const steps: Step[] = []
    infos.forEach((info, idx) => {
      const out = join(tempDir, `norm_${idx}.mp4`)
      normalized.push(out)
      steps.push({
        args: buildNormalizeArgs(
          info.filePath,
          out,
          target.width,
          target.height,
          targetFps,
          info.audioCodec !== null
        ),
        expectedDuration: info.duration
      })
    })

    // 正規化後は仕様が揃うので concat demuxer copy で連結
    // 進捗は正規化ステップ群のあとに連結ステップを追加
    // （連結は copy なので短時間。合計長は全体長とする）
    const totalDuration = infos.reduce((s, i) => s + i.duration, 0)

    // まず正規化を実行（進捗按分のため runSteps を分割せず一括構成）
    // 連結ステップはリストファイルが正規化後に必要なので、正規化完了後に生成する
    await runSteps(steps, (p) => {
      // 正規化フェーズは全体の 0〜90% に割り当てる
      if (p === null) progress(null)
      else progress(Math.min(90, Math.round(p * 0.9)))
    })

    const listPath = await writeConcatList(tempDir, normalized)
    await runFfmpeg(buildConcatDemuxerArgs(listPath, req.output, true), (localSec) => {
      // 連結フェーズは 90〜100%
      if (totalDuration > 0) {
        progress(Math.min(100, 90 + Math.round((localSec / totalDuration) * 10)))
      }
    })
    progress(100)
    return { note: '動画の仕様が異なったため、揃えてから結合しました（再エンコード）。' }
  } finally {
    // 一時ファイルを掃除
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}
