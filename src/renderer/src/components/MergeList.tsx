import React, { useState } from 'react'
import type { VideoInfo } from '@shared/types'
import { formatTime } from '@shared/time'

export interface MergeEntry {
  id: string
  info: VideoInfo
}

interface Props {
  items: MergeEntry[]
  busy: boolean
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onRemove: (index: number) => void
  onReorder: (from: number, to: number) => void
  onMerge: () => void
}

/**
 * 結合対象の動画一覧。
 * 上へ/下へ/削除に加え、ドラッグ＆ドロップでの並び替えに対応。
 */
export default function MergeList({
  items,
  busy,
  onMoveUp,
  onMoveDown,
  onRemove,
  onReorder,
  onMerge
}: Props): React.JSX.Element {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const canMerge = items.length >= 2 && !busy

  const handleDrop = (to: number): void => {
    if (dragIndex !== null && dragIndex !== to) onReorder(dragIndex, to)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div>
      <div className="section-title">結合リスト（{items.length} 本）</div>
      {items.length === 0 ? (
        <p className="hint">「結合リストに動画を追加」で 2 本以上追加してください。ドラッグで並び替えできます。</p>
      ) : (
        <ul className="merge-list">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`merge-item${dragIndex === index ? ' dragging' : ''}${overIndex === index ? ' drag-over' : ''}`}
              draggable={!busy}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault()
                setOverIndex(index)
              }}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
            >
              <span className="meta">{index + 1}.</span>
              <span className="name" title={item.info.filePath}>
                {item.info.fileName}
              </span>
              <span className="meta">
                {item.info.width}×{item.info.height} / {formatTime(item.info.duration)}
              </span>
              <button className="icon" onClick={() => onMoveUp(index)} disabled={busy || index === 0} title="上へ">
                ↑
              </button>
              <button
                className="icon"
                onClick={() => onMoveDown(index)}
                disabled={busy || index === items.length - 1}
                title="下へ"
              >
                ↓
              </button>
              <button className="icon" onClick={() => onRemove(index)} disabled={busy} title="削除">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 10 }}>
        <button className="primary" onClick={onMerge} disabled={!canMerge} style={{ width: '100%' }}>
          動画を結合して保存
        </button>
        {items.length === 1 && <p className="hint">結合には 2 本以上必要です。</p>}
      </div>
    </div>
  )
}
