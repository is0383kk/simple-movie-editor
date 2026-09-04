import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * <video> 要素の再生状態を管理するフック。
 * videoRef を <video> に割り当てて使う。
 */
export function usePlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  // 再生プレビュー用の音量（0〜1）とミュート。動画データ自体は編集しない
  const [volume, setVolumeState] = useState(1)
  const [muted, setMuted] = useState(false)

  // video 要素のイベントを購読
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const onTime = (): void => setCurrentTime(el.currentTime)
    const onDuration = (): void => setDuration(isFinite(el.duration) ? el.duration : 0)
    const onPlay = (): void => setIsPlaying(true)
    const onPause = (): void => setIsPlaying(false)

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onDuration)
    el.addEventListener('durationchange', onDuration)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onPause)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onDuration)
      el.removeEventListener('durationchange', onDuration)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onPause)
    }
  })

  // 音量/ミュートを video 要素へ反映（毎レンダー実行なので、動画の差し替え後も適用される）
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.volume = volume
    el.muted = muted
  })

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    setVolumeState(clamped)
    // 音量を上げたらミュートは解除する（一般的な挙動）
    if (clamped > 0) setMuted(false)
  }, [])
  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  const play = useCallback(() => {
    videoRef.current?.play().catch(() => {})
  }, [])
  const pause = useCallback(() => {
    videoRef.current?.pause()
  }, [])
  const toggle = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }, [])
  const seek = useCallback((sec: number) => {
    const el = videoRef.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(sec, el.duration || sec))
    setCurrentTime(el.currentTime)
  }, [])

  return {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    volume,
    muted,
    play,
    pause,
    toggle,
    seek,
    setVolume,
    toggleMute
  }
}
