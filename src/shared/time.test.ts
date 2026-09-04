import { describe, it, expect } from 'vitest'
import { formatTime, parseTime, toFfmpegTime } from './time'

describe('formatTime', () => {
  it('秒を HH:MM:SS.mmm にする', () => {
    expect(formatTime(0)).toBe('00:00:00.000')
    expect(formatTime(1.5)).toBe('00:00:01.500')
    expect(formatTime(65.25)).toBe('00:01:05.250')
    expect(formatTime(3661.001)).toBe('01:01:01.001')
  })
  it('負値・非有限は 0 として扱う', () => {
    expect(formatTime(-5)).toBe('00:00:00.000')
    expect(formatTime(Infinity)).toBe('00:00:00.000')
  })
})

describe('parseTime', () => {
  it('各形式を秒に変換する', () => {
    expect(parseTime('01:01:01.001')).toBeCloseTo(3661.001, 3)
    expect(parseTime('01:05.25')).toBeCloseTo(65.25, 3)
    expect(parseTime('90')).toBe(90)
  })
  it('不正入力は null', () => {
    expect(parseTime('')).toBeNull()
    expect(parseTime('a:b')).toBeNull()
    expect(parseTime('1:2:3:4')).toBeNull()
  })
})

describe('toFfmpegTime', () => {
  it('小数 3 桁の秒文字列を返す', () => {
    expect(toFfmpegTime(12.3456)).toBe('12.346')
    expect(toFfmpegTime(-1)).toBe('0.000')
  })
})
