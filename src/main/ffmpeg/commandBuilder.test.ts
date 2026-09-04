import { describe, it, expect } from 'vitest'
import {
  buildClipEncodeArgs,
  buildTrimArgs,
  buildConcatDemuxerArgs,
  buildNormalizeArgs
} from './commandBuilder'

describe('buildClipEncodeArgs', () => {
  it('入力シーク + -t（長さ）+ 再エンコードを生成する', () => {
    const args = buildClipEncodeArgs('in.mp4', 'out.mp4', 2, 5)
    expect(args[args.indexOf('-ss') + 1]).toBe('2.000')
    expect(args[args.indexOf('-t') + 1]).toBe('3.000') // end - start
    expect(args).toContain('libx264')
    expect(args).toContain('aac')
    expect(args).toContain('out.mp4')
  })
})

describe('buildTrimArgs', () => {
  it('音声ありは atrim/concat a=1 を含む', () => {
    const args = buildTrimArgs('in.mp4', 'out.mp4', 3, 7, true)
    const filter = args[args.indexOf('-filter_complex') + 1]
    expect(filter).toContain('atrim')
    expect(filter).toContain('concat=n=2:v=1:a=1')
  })
  it('音声なしは映像のみ concat a=0', () => {
    const args = buildTrimArgs('in.mp4', 'out.mp4', 3, 7, false)
    const filter = args[args.indexOf('-filter_complex') + 1]
    expect(filter).not.toContain('atrim')
    expect(filter).toContain('concat=n=2:v=1:a=0')
  })
})

describe('buildConcatDemuxerArgs', () => {
  it('copy=true はストリームコピー', () => {
    const args = buildConcatDemuxerArgs('list.txt', 'out.mp4', true)
    expect(args).toContain('concat')
    expect(args).toContain('copy')
  })
  it('copy=false は再エンコード', () => {
    const args = buildConcatDemuxerArgs('list.txt', 'out.mp4', false)
    expect(args).toContain('libx264')
  })
})

describe('buildNormalizeArgs', () => {
  it('音声なしは anullsrc で無音を合成する', () => {
    const args = buildNormalizeArgs('in.mp4', 'out.mp4', 1920, 1080, 30, false)
    expect(args.join(' ')).toContain('anullsrc')
  })
  it('scale/pad/fps を含む', () => {
    const args = buildNormalizeArgs('in.mp4', 'out.mp4', 1280, 720, 30, true)
    const vf = args[args.indexOf('-vf') + 1]
    expect(vf).toContain('scale=1280:720')
    expect(vf).toContain('pad=1280:720')
    expect(vf).toContain('fps=30')
  })
})
