import React from 'react'
import { formatTime } from '@shared/time'

interface Props {
  hasVideo: boolean
  isPlaying: boolean
  canPlay: boolean
  inPoint: number | null
  outPoint: number | null
  busy: boolean
  volume: number
  muted: boolean
  onSkipBack: () => void
  onSkipForward: () => void
  onToggle: () => void
  onSetIn: () => void
  onSetOut: () => void
  onClearPoints: () => void
  onSaveClip: () => void
  onDeleteRange: () => void
  onVolumeChange: (v: number) => void
  onToggleMute: () => void
}

/** 再生/一時停止・開始終了地点設定・クリップ保存/範囲削除の操作群 */
export default function Controls(props: Props): React.JSX.Element {
  const {
    hasVideo,
    isPlaying,
    canPlay,
    inPoint,
    outPoint,
    busy,
    volume,
    muted,
    onSkipBack,
    onSkipForward,
    onToggle,
    onSetIn,
    onSetOut,
    onClearPoints,
    onSaveClip,
    onDeleteRange,
    onVolumeChange,
    onToggleMute
  } = props

  // 有効な範囲（開始 < 終了）が指定されているか
  const validRange = inPoint !== null && outPoint !== null && outPoint > inPoint
  const disabled = !hasVideo || busy

  return (
    <div className="controls">
      <div className="group">
        <button onClick={onSkipBack} disabled={disabled || !canPlay} className="icon" title="10秒 巻き戻し">
          ⏪ 10秒
        </button>
        <button onClick={onToggle} disabled={disabled || !canPlay} className="icon" title="再生 / 一時停止">
          {isPlaying ? '⏸ 一時停止' : '▶ 再生'}
        </button>
        <button onClick={onSkipForward} disabled={disabled || !canPlay} className="icon" title="10秒 早送り">
          10秒 ⏩
        </button>
      </div>

      {/* 再生プレビュー用の音量（動画データ自体は変更しない） */}
      <div className="group">
        <button
          className="icon"
          onClick={onToggleMute}
          disabled={disabled || !canPlay}
          title={muted ? 'ミュート解除' : 'ミュート'}
        >
          {muted || volume === 0 ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          className="volume-slider"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          disabled={disabled || !canPlay}
          title="音量"
          aria-label="音量"
        />
        <span className="point-badge">
          <b>{Math.round((muted ? 0 : volume) * 100)}</b>%
        </span>
      </div>

      <div className="group">
        <button onClick={onSetIn} disabled={disabled} title="現在位置を開始地点に設定">
          ここを開始地点にする
        </button>
        <button onClick={onSetOut} disabled={disabled} title="現在位置を終了地点に設定">
          ここを終了地点にする
        </button>
        <button onClick={onClearPoints} disabled={disabled || (inPoint === null && outPoint === null)}>
          範囲クリア
        </button>
      </div>

      <span className="point-badge">
        開始 <b>{inPoint !== null ? formatTime(inPoint) : '—'}</b> / 終了{' '}
        <b>{outPoint !== null ? formatTime(outPoint) : '—'}</b>
      </span>

      <div className="spacer" />

      <div className="group">
        <button className="primary" onClick={onSaveClip} disabled={disabled || !validRange} title="選択範囲を新しい動画として保存">
          選択範囲をクリップとして保存
        </button>
        <button className="danger" onClick={onDeleteRange} disabled={disabled || !validRange} title="選択範囲を削除して保存">
          選択範囲を削除
        </button>
      </div>
    </div>
  )
}
