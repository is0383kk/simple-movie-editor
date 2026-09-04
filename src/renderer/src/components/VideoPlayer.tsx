import React from 'react'
import type { VideoInfo } from '@shared/types'
import { formatTime } from '@shared/time'

interface Props {
  video: VideoInfo | null
  src: string | null
  videoRef: React.RefObject<HTMLVideoElement>
  canPlay: boolean
  onError: () => void
  onToggle: () => void
}

/** 動画プレビュー（HTML5 video）と情報表示 */
export default function VideoPlayer({ video, src, videoRef, canPlay, onError, onToggle }: Props): React.JSX.Element {
  return (
    <>
      {video && (
        <div className="video-info">
          <span>
            <b>{video.fileName}</b>
          </span>
          <span>長さ: <b>{formatTime(video.duration)}</b></span>
          <span>解像度: <b>{video.width}×{video.height}</b></span>
          <span>fps: <b>{video.fps || '—'}</b></span>
          <span>コーデック: <b>{video.videoCodec}{video.audioCodec ? ` / ${video.audioCodec}` : '（音声なし）'}</b></span>
        </div>
      )}
      <div className="preview">
        {src ? (
          canPlay ? (
            <video ref={videoRef} src={src} onError={onError} onClick={onToggle} />
          ) : (
            <div className="placeholder">
              この動画はプレビュー再生に対応していないコーデックの可能性があります。
              <br />
              （編集・書き出しは可能です）
            </div>
          )
        ) : (
          <div className="placeholder">「動画を開く」から編集する動画を読み込んでください。</div>
        )}
      </div>
    </>
  )
}
