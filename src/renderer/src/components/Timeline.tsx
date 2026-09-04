import React, { useRef } from 'react'
import { formatTime } from '@shared/time'

interface Props {
  duration: number
  currentTime: number
  inPoint: number | null
  outPoint: number | null
  onSeek: (sec: number) => void
  /** ドラッグ（スクラブ）開始時 */
  onScrubStart?: () => void
  /** ドラッグ（スクラブ）終了時 */
  onScrubEnd?: () => void
}

/**
 * シークバーを拡張した簡易タイムライン。
 * - 現在の再生位置（白い線）
 * - 開始地点/終了地点（選択範囲を半透明で表示、緑/赤の境界）
 * クリックでその位置へシーク、ドラッグでリアルタイムにスクラブ（プレビュー）できる。
 * setPointerCapture によりバーの外へドラッグしても追従する。
 */
export default function Timeline({
  duration,
  currentTime,
  inPoint,
  outPoint,
  onSeek,
  onScrubStart,
  onScrubEnd
}: Props): React.JSX.Element {
  const barRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  const pct = (sec: number): number => (duration > 0 ? Math.max(0, Math.min(100, (sec / duration) * 100)) : 0)

  // ポインタの X 座標から再生位置を算出してシーク（0〜duration にクランプ）
  const seekFromClientX = (clientX: number): void => {
    const bar = barRef.current
    if (!bar || duration <= 0) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(ratio * duration)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (duration <= 0) return
    draggingRef.current = true
    barRef.current?.setPointerCapture(e.pointerId)
    onScrubStart?.()
    seekFromClientX(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    seekFromClientX(e.clientX)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (barRef.current?.hasPointerCapture(e.pointerId)) {
      barRef.current.releasePointerCapture(e.pointerId)
    }
    onScrubEnd?.()
  }

  const selLeft = inPoint !== null ? pct(inPoint) : null
  const selRight = outPoint !== null ? pct(outPoint) : null

  return (
    <div
      className="timeline"
      ref={barRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      title="クリック / ドラッグで再生位置を移動"
    >
      {/* 選択範囲（開始〜終了） */}
      {selLeft !== null && selRight !== null && selRight > selLeft && (
        <div className="selection" style={{ left: `${selLeft}%`, width: `${selRight - selLeft}%` }} />
      )}
      {/* 開始/終了マーカーのラベル */}
      {inPoint !== null && (
        <div className="marker-label" style={{ left: `${pct(inPoint)}%`, color: 'var(--in)' }}>
          ▶ {formatTime(inPoint)}
        </div>
      )}
      {outPoint !== null && (
        <div className="marker-label" style={{ left: `${pct(outPoint)}%`, color: 'var(--out)' }}>
          ◀ {formatTime(outPoint)}
        </div>
      )}
      {/* 再生位置 */}
      <div className="playhead" style={{ left: `${pct(currentTime)}%` }} />
    </div>
  )
}
