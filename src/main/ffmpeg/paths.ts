import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

// ffmpeg-static / ffprobe-static は開発時は node_modules 内のパスを返す。
// パッケージ後は asar 内に入るため、実行可能にするには asar.unpacked 側を参照する。
// package.json の build.asarUnpack で unpack 指定済み。
function resolveUnpacked(p: string): string {
  // app.asar 内のパスを app.asar.unpacked に読み替える
  return p.replace('app.asar', 'app.asar.unpacked')
}

/** ffmpeg 実行バイナリの絶対パス */
export const ffmpegPath: string = resolveUnpacked(ffmpegStatic as unknown as string)

/** ffprobe 実行バイナリの絶対パス */
export const ffprobePath: string = resolveUnpacked(ffprobeStatic.path)
