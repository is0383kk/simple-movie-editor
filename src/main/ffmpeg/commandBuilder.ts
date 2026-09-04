// ============================================================================
// FFmpeg コマンド（引数配列）生成 — 純粋関数のみ。副作用なし＝単体テスト容易。
// 各関数は ffmpeg に渡す引数配列を返す（バイナリパスは含めない）。
// spawn へ配列で渡すため、日本語やスペースを含むパスもシェルを経由せず安全。
// ============================================================================
import { toFfmpegTime } from '@shared/time'

/** 共通の再エンコード設定（H.264 / AAC、faststart で先頭に moov を配置） */
const ENCODE_VIDEO = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20']
const ENCODE_AUDIO = ['-c:a', 'aac', '-b:a', '192k']
const FASTSTART = ['-movflags', '+faststart']

// ---------------------------------------------------------------------------
// 1. クリップ切り出し（start〜end の範囲を出力）
// ---------------------------------------------------------------------------

/**
 * 再エンコードで切り出す。
 * -ss を -i の前に置いて入力シーク（高速）＋ -t で長さ指定。再エンコードのため
 * 開始/終了がフレーム精度で一致する（＝指定範囲を正確に切り出せる）。
 *
 * 補足: ストリームコピー（-c copy）はキーフレーム境界でしか切れず、任意の開始点では
 * 位置・長さがずれる（かつエラーにならない）ため、切り出しでは採用しない。
 * 「速度より正常に書き出せること」を優先する方針に沿って再エンコードを既定とする。
 */
export function buildClipEncodeArgs(input: string, output: string, start: number, end: number): string[] {
  const duration = end - start
  return [
    '-ss', toFfmpegTime(start),
    '-i', input,
    '-t', toFfmpegTime(duration),
    ...ENCODE_VIDEO,
    ...ENCODE_AUDIO,
    ...FASTSTART,
    '-y', output
  ]
}

// ---------------------------------------------------------------------------
// 2. 範囲削除（start〜end を取り除き、前後を連結）
//    filter_complex の trim/atrim + concat で 1 コマンドで確実に処理する。
//    hasAudio によって音声処理の有無を切り替える。
// ---------------------------------------------------------------------------

/**
 * [0, start] と [end, 末尾] を連結した動画を書き出す（再エンコード）。
 * 音声がある場合は atrim も併用して映像と同時に連結する。
 */
export function buildTrimArgs(
  input: string,
  output: string,
  start: number,
  end: number,
  hasAudio: boolean
): string[] {
  const s = toFfmpegTime(start)
  const e = toFfmpegTime(end)

  if (hasAudio) {
    // 映像・音声それぞれを前半/後半に分割し、concat で 2 セグメント連結
    const filter =
      `[0:v]trim=start=0:end=${s},setpts=PTS-STARTPTS[v0];` +
      `[0:a]atrim=start=0:end=${s},asetpts=PTS-STARTPTS[a0];` +
      `[0:v]trim=start=${e},setpts=PTS-STARTPTS[v1];` +
      `[0:a]atrim=start=${e},asetpts=PTS-STARTPTS[a1];` +
      `[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]`
    return [
      '-i', input,
      '-filter_complex', filter,
      '-map', '[outv]',
      '-map', '[outa]',
      ...ENCODE_VIDEO,
      ...ENCODE_AUDIO,
      ...FASTSTART,
      '-y', output
    ]
  }

  // 音声なし
  const filter =
    `[0:v]trim=start=0:end=${s},setpts=PTS-STARTPTS[v0];` +
    `[0:v]trim=start=${e},setpts=PTS-STARTPTS[v1];` +
    `[v0][v1]concat=n=2:v=1:a=0[outv]`
  return [
    '-i', input,
    '-filter_complex', filter,
    '-map', '[outv]',
    ...ENCODE_VIDEO,
    ...FASTSTART,
    '-y', output
  ]
}

// ---------------------------------------------------------------------------
// 3. 結合
//    (a) 全入力が同一コーデック/解像度/fps → concat demuxer + copy（高速・無劣化）
//    (b) 差異あり → 各入力を共通仕様へ正規化（再エンコード）後に concat demuxer copy
// ---------------------------------------------------------------------------

/**
 * concat demuxer でリストファイル（file '...' の羅列）から結合する。
 * copy=true なら無劣化コピー。
 */
export function buildConcatDemuxerArgs(listFile: string, output: string, copy: boolean): string[] {
  const base = ['-f', 'concat', '-safe', '0', '-i', listFile]
  if (copy) {
    return [...base, '-c', 'copy', ...FASTSTART, '-y', output]
  }
  return [...base, ...ENCODE_VIDEO, ...ENCODE_AUDIO, ...FASTSTART, '-y', output]
}

/**
 * 結合前の正規化。共通の解像度・fps・コーデックへ揃える。
 * 音声が無い入力には無音を付与し、全入力の構成を揃えて concat demuxer を安全にする。
 * アスペクト比は維持し、余白を黒でパディングする。
 */
export function buildNormalizeArgs(
  input: string,
  output: string,
  width: number,
  height: number,
  fps: number,
  hasAudio: boolean
): string[] {
  const vf =
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}`

  if (hasAudio) {
    return [
      '-i', input,
      '-vf', vf,
      ...ENCODE_VIDEO,
      ...ENCODE_AUDIO,
      '-ar', '48000',
      '-y', output
    ]
  }

  // 無音トラックを合成（anullsrc）して音声ありに揃える
  return [
    '-i', input,
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-vf', vf,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    ...ENCODE_VIDEO,
    ...ENCODE_AUDIO,
    '-y', output
  ]
}
