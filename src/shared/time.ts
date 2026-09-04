// ============================================================================
// 時間フォーマットユーティリティ（純粋関数・テスト対象）
// 表示形式は HH:MM:SS.mmm を基本とする。
// ============================================================================

/** 秒数を HH:MM:SS.mmm 形式にフォーマットする */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const totalMs = Math.round(seconds * 1000)
  const ms = totalMs % 1000
  const totalSec = Math.floor(totalMs / 1000)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60) % 60
  const h = Math.floor(totalSec / 3600)
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`
}

/**
 * HH:MM:SS.mmm / MM:SS.mmm / SS などの文字列を秒数に変換する。
 * パースできない場合は null を返す。
 */
export function parseTime(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const parts = trimmed.split(':')
  if (parts.length > 3) return null
  let seconds = 0
  for (const part of parts) {
    const value = Number(part)
    if (Number.isNaN(value) || value < 0) return null
    seconds = seconds * 60 + value
  }
  return seconds
}

/**
 * ffmpeg の -ss / -to に渡す時間文字列を生成する。
 * ffmpeg は秒数の小数（例: 12.345）をそのまま解釈できる。
 */
export function toFfmpegTime(seconds: number): string {
  return Math.max(0, seconds).toFixed(3)
}
