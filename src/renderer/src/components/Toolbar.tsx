import React from 'react'

interface Props {
  busy: boolean
  onOpenVideo: () => void
  onAddVideos: () => void
}

/** 上部ツールバー: 動画を開く / 結合リストへ追加 */
export default function Toolbar({ busy, onOpenVideo, onAddVideos }: Props): React.JSX.Element {
  return (
    <div className="toolbar">
      <span className="title">シンプル動画編集</span>
      <button className="primary" onClick={onOpenVideo} disabled={busy}>
        動画を開く
      </button>
      <button onClick={onAddVideos} disabled={busy}>
        結合リストに動画を追加
      </button>
    </div>
  )
}
