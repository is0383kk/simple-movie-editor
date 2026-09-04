import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoInfo, ExportResult } from '@shared/types'
import { formatTime } from '@shared/time'
import { usePlayer } from './hooks/usePlayer'
import { makeOutputName } from './lib/filename'
import Toolbar from './components/Toolbar'
import VideoPlayer from './components/VideoPlayer'
import Timeline from './components/Timeline'
import Controls from './components/Controls'
import MergeList, { MergeEntry } from './components/MergeList'
import ProgressOverlay, { JobState } from './components/ProgressOverlay'

let entrySeq = 0
const nextId = (): string => `m${++entrySeq}`

export default function App(): React.JSX.Element {
  const { videoRef, currentTime, duration, isPlaying, volume, muted, play, pause, toggle, seek, setVolume, toggleMute } =
    usePlayer()

  // スクラブ（ドラッグ）中は一時停止し、終了後に元の再生状態へ戻すためのフラグ
  const wasPlayingRef = useRef(false)

  const [current, setCurrent] = useState<VideoInfo | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [canPlay, setCanPlay] = useState(true)
  const [inPoint, setInPoint] = useState<number | null>(null)
  const [outPoint, setOutPoint] = useState<number | null>(null)
  const [mergeItems, setMergeItems] = useState<MergeEntry[]>([])
  const [job, setJob] = useState<JobState>({ active: false, percent: null })
  const [error, setError] = useState<string | null>(null)

  const busyRef = useRef(false)
  busyRef.current = job.active

  // 進捗イベント購読（処理中のみ反映）
  useEffect(() => {
    const off = window.editor.onProgress((p) => {
      setJob((prev) => (prev.active ? { ...prev, percent: p.percent, message: p.message ?? prev.message } : prev))
    })
    return off
  }, [])

  // --- 動画を開く ---
  const handleOpenVideo = useCallback(async () => {
    setError(null)
    const res = await window.editor.openVideo()
    if (res.canceled || !res.filePath) return
    try {
      const info = await window.editor.probe(res.filePath)
      setCurrent(info)
      setSrc(window.editor.toFileUrl(info.filePath))
      setCanPlay(true)
      setInPoint(null)
      setOutPoint(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '動画の読み込みに失敗しました。')
    }
  }, [])

  // --- 結合リストに追加 ---
  const handleAddVideos = useCallback(async () => {
    setError(null)
    const res = await window.editor.openVideos()
    if (res.canceled || res.filePaths.length === 0) return
    const added: MergeEntry[] = []
    const failed: string[] = []
    for (const fp of res.filePaths) {
      try {
        const info = await window.editor.probe(fp)
        added.push({ id: nextId(), info })
      } catch {
        failed.push(fp)
      }
    }
    if (added.length > 0) setMergeItems((prev) => [...prev, ...added])
    if (failed.length > 0) setError(`次のファイルは読み込めませんでした: ${failed.join(', ')}`)
  }, [])

  // --- 開始/終了地点 ---
  // 現在位置から相対的にシーク（巻き戻し/早送り。seek 側で 0〜duration にクランプ）
  const skip = useCallback((delta: number) => seek(currentTime + delta), [currentTime, seek])

  const setIn = useCallback(() => setInPoint(Math.round(currentTime * 1000) / 1000), [currentTime])
  const setOut = useCallback(() => setOutPoint(Math.round(currentTime * 1000) / 1000), [currentTime])
  const clearPoints = useCallback(() => {
    setInPoint(null)
    setOutPoint(null)
  }, [])

  // 範囲バリデーション。問題があればエラー文言を返す
  const validateRange = (): string | null => {
    if (inPoint === null || outPoint === null) return '開始地点と終了地点を指定してください。'
    if (inPoint === outPoint) return '開始地点と終了地点が同じです。範囲を指定してください。'
    if (inPoint > outPoint) return '開始地点が終了地点より後になっています。順序を見直してください。'
    return null
  }

  // 書き出しジョブ共通処理
  const runJob = useCallback(async (label: string, task: () => Promise<ExportResult>) => {
    setError(null)
    setJob({ active: true, percent: 0, message: `${label}…` })
    try {
      const result = await task()
      if (result.success) {
        const note = result.note ? `\n${result.note}` : ''
        setJob({ active: false, percent: 100, result: { success: true, text: `保存しました:\n${result.output}${note}` } })
      } else {
        setJob({ active: false, percent: null, result: { success: false, text: result.error ?? '不明なエラー' } })
      }
    } catch (e) {
      setJob({
        active: false,
        percent: null,
        result: { success: false, text: e instanceof Error ? e.message : String(e) }
      })
    }
  }, [])

  // --- クリップ保存 ---
  const handleSaveClip = useCallback(async () => {
    if (!current) return
    const err = validateRange()
    if (err) {
      setError(err)
      return
    }
    const save = await window.editor.saveDialog(makeOutputName(current.fileName, 'clip'))
    if (save.canceled || !save.filePath) return
    await runJob('クリップを書き出しています', () =>
      window.editor.exportClip({ input: current.filePath, output: save.filePath!, start: inPoint!, end: outPoint! })
    )
  }, [current, inPoint, outPoint, runJob])

  // --- 範囲削除 ---
  const handleDeleteRange = useCallback(async () => {
    if (!current) return
    const err = validateRange()
    if (err) {
      setError(err)
      return
    }
    const save = await window.editor.saveDialog(makeOutputName(current.fileName, 'trimmed'))
    if (save.canceled || !save.filePath) return
    await runJob('選択範囲を削除して書き出しています', () =>
      window.editor.exportTrim({ input: current.filePath, output: save.filePath!, start: inPoint!, end: outPoint! })
    )
  }, [current, inPoint, outPoint, runJob])

  // --- 結合リスト操作 ---
  const moveUp = (i: number): void =>
    setMergeItems((prev) => (i <= 0 ? prev : swap(prev, i, i - 1)))
  const moveDown = (i: number): void =>
    setMergeItems((prev) => (i >= prev.length - 1 ? prev : swap(prev, i, i + 1)))
  const removeItem = (i: number): void => setMergeItems((prev) => prev.filter((_, idx) => idx !== i))
  const reorder = (from: number, to: number): void =>
    setMergeItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  // --- 結合 ---
  const handleMerge = useCallback(async () => {
    if (mergeItems.length < 2) {
      setError('結合には 2 本以上の動画が必要です。')
      return
    }
    const save = await window.editor.saveDialog('merged.mp4')
    if (save.canceled || !save.filePath) return
    await runJob('動画を結合しています', () =>
      window.editor.exportMerge({ inputs: mergeItems.map((m) => m.info.filePath), output: save.filePath! })
    )
  }, [mergeItems, runJob])

  const busy = job.active

  return (
    <div className="app">
      <Toolbar busy={busy} onOpenVideo={handleOpenVideo} onAddVideos={handleAddVideos} />

      <div className="main">
        <div className="editor-pane">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError(null)}>閉じる</button>
            </div>
          )}

          <VideoPlayer
            video={current}
            src={src}
            videoRef={videoRef}
            canPlay={canPlay}
            onError={() => setCanPlay(false)}
            onToggle={toggle}
          />

          <Timeline
            duration={duration || current?.duration || 0}
            currentTime={currentTime}
            inPoint={inPoint}
            outPoint={outPoint}
            onSeek={seek}
            onScrubStart={() => {
              wasPlayingRef.current = isPlaying
              pause()
            }}
            onScrubEnd={() => {
              if (wasPlayingRef.current) play()
            }}
          />

          <div className="time-readout">
            <span className="current">{formatTime(currentTime)}</span>
            <span>{formatTime(duration || current?.duration || 0)}</span>
          </div>

          <Controls
            hasVideo={!!current}
            isPlaying={isPlaying}
            canPlay={canPlay}
            inPoint={inPoint}
            outPoint={outPoint}
            busy={busy}
            volume={volume}
            muted={muted}
            onSkipBack={() => skip(-10)}
            onSkipForward={() => skip(10)}
            onToggle={toggle}
            onSetIn={setIn}
            onSetOut={setOut}
            onClearPoints={clearPoints}
            onSaveClip={handleSaveClip}
            onDeleteRange={handleDeleteRange}
            onVolumeChange={setVolume}
            onToggleMute={toggleMute}
          />
        </div>

        <div className="side-pane">
          <MergeList
            items={mergeItems}
            busy={busy}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onRemove={removeItem}
            onReorder={reorder}
            onMerge={handleMerge}
          />
        </div>
      </div>

      <ProgressOverlay job={job} onClose={() => setJob({ active: false, percent: null })} />
    </div>
  )
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}
