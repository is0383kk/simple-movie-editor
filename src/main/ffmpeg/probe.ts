import { execFile } from 'child_process'
import { basename } from 'path'
import { promisify } from 'util'
import { ffprobePath } from './paths'
import type { VideoInfo } from '@shared/types'

const execFileAsync = promisify(execFile)

interface FfprobeStream {
  codec_type: string
  codec_name?: string
  width?: number
  height?: number
  r_frame_rate?: string
  avg_frame_rate?: string
  duration?: string
}

interface FfprobeOutput {
  streams: FfprobeStream[]
  format: { duration?: string }
}

/** "30000/1001" 形式のフレームレート文字列を数値へ変換 */
function parseFrameRate(rate: string | undefined): number {
  if (!rate) return 0
  const [num, den] = rate.split('/').map(Number)
  if (!den || Number.isNaN(num) || Number.isNaN(den)) return 0
  return Math.round((num / den) * 1000) / 1000
}

/**
 * ffprobe で動画情報を取得する。
 * 実行コマンド:
 *   ffprobe -v quiet -print_format json -show_format -show_streams <input>
 */
export async function probeVideo(filePath: string): Promise<VideoInfo> {
  let stdout: string
  try {
    const result = await execFileAsync(
      ffprobePath,
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
      { maxBuffer: 10 * 1024 * 1024 }
    )
    stdout = result.stdout
  } catch {
    throw new Error('動画情報の取得に失敗しました。対応していない形式か、ファイルが壊れている可能性があります。')
  }

  let data: FfprobeOutput
  try {
    data = JSON.parse(stdout)
  } catch {
    throw new Error('動画情報の解析に失敗しました。')
  }

  const videoStream = data.streams?.find((s) => s.codec_type === 'video')
  const audioStream = data.streams?.find((s) => s.codec_type === 'audio')

  if (!videoStream) {
    throw new Error('映像ストリームが見つかりませんでした。動画ファイルではない可能性があります。')
  }

  const duration = Number(data.format?.duration ?? videoStream.duration ?? 0)
  const fps = parseFrameRate(videoStream.avg_frame_rate) || parseFrameRate(videoStream.r_frame_rate)

  return {
    filePath,
    fileName: basename(filePath),
    duration: Number.isFinite(duration) ? duration : 0,
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    fps,
    videoCodec: videoStream.codec_name ?? 'unknown',
    audioCodec: audioStream?.codec_name ?? null
  }
}

/**
 * 複数動画が concat demuxer で無劣化コピー可能か（=仕様が一致するか）を判定。
 * コーデック・解像度・fps・音声コーデックがすべて一致すれば true。
 */
export function isUniform(infos: VideoInfo[]): boolean {
  if (infos.length < 2) return true
  const first = infos[0]
  return infos.every(
    (i) =>
      i.videoCodec === first.videoCodec &&
      i.width === first.width &&
      i.height === first.height &&
      Math.abs(i.fps - first.fps) < 0.01 &&
      i.audioCodec === first.audioCodec
  )
}
