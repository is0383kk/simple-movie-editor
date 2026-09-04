/**
 * 元ファイル名から、操作種別に応じた既定の出力ファイル名を作る。
 * 元ファイルを上書きしないよう、サフィックスを付けて拡張子は .mp4 に統一する。
 * 例: movie.mov + 'clip' → movie_clip.mp4
 */
export function makeOutputName(originalName: string, suffix: string): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  return `${base}_${suffix}.mp4`
}
