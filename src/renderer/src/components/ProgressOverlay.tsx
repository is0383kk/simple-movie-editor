import React from 'react'

export interface JobState {
  active: boolean
  percent: number | null
  message?: string
  /** 完了/失敗の結果表示（active=false のときに表示） */
  result?: { success: boolean; text: string }
}

interface Props {
  job: JobState
  onClose: () => void
}

const KIND_LABEL = '処理中'

/** 書き出し/結合の処理中・完了・失敗を表示するモーダル */
export default function ProgressOverlay({ job, onClose }: Props): React.JSX.Element | null {
  if (!job.active && !job.result) return null

  return (
    <div className="overlay">
      <div className="box">
        {job.active ? (
          <>
            <div>{job.message ?? `${KIND_LABEL}…`}</div>
            <div className={`progress-bar${job.percent === null ? ' indeterminate' : ''}`}>
              <div style={{ width: `${job.percent ?? 0}%` }} />
            </div>
            <div style={{ color: 'var(--muted)' }}>
              {job.percent !== null ? `${job.percent}%` : '処理を実行しています…'}
            </div>
          </>
        ) : (
          job.result && (
            <>
              <div className={job.result.success ? 'result-ok' : 'result-ng'} style={{ fontSize: 15, marginBottom: 12 }}>
                {job.result.success ? '✅ 処理が完了しました' : '⚠ 処理に失敗しました'}
              </div>
              <div style={{ color: 'var(--muted)', marginBottom: 16, wordBreak: 'break-all' }}>{job.result.text}</div>
              <button className="primary" onClick={onClose}>
                閉じる
              </button>
            </>
          )
        )}
      </div>
    </div>
  )
}
