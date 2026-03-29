// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let playSpy
let gainNode
let oscillatorNode

const loadAudioManager = async () => {
  vi.resetModules()
  return import('./audioManager')
}

beforeEach(() => {
  playSpy = vi.fn().mockImplementation(function () {
    this.paused = false
    return Promise.resolve()
  })

  class MockAudio {
    constructor(src) {
      this.src = src
      this.volume = 1
      this.muted = false
      this.paused = true
      this.listeners = new Map()
    }

    addEventListener(event, handler) {
      this.listeners.set(event, handler)
    }

    dispatch(event) {
      this.listeners.get(event)?.()
    }

    play() {
      return playSpy.call(this)
    }
  }

  gainNode = {
    gain: {
      value: 0,
      setTargetAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }

  oscillatorNode = {
    type: 'sine',
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 12
      this.destination = {}
    }

    createGain() {
      return gainNode
    }

    createOscillator() {
      return oscillatorNode
    }
  }

  vi.stubGlobal('Audio', MockAudio)
  window.AudioContext = MockAudioContext
  window.webkitAudioContext = undefined
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.AudioContext
  delete window.webkitAudioContext
  vi.resetModules()
})

describe('audioManager', () => {
  it('initializes audio context and gain only once', async () => {
    const { audioManager } = await loadAudioManager()

    audioManager.init()
    audioManager.init()

    expect(audioManager.initialized).toBe(true)
    expect(audioManager.masterGain.gain.value).toBe(0.8)
  })

  it('mutes and unmutes background audio, restarting playback when needed', async () => {
    const { audioManager } = await loadAudioManager()
    audioManager.init()

    audioManager.setMuted(true)
    expect(audioManager.isMuted).toBe(true)
    expect(audioManager.bgmAudio.muted).toBe(true)
    expect(gainNode.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 12, 0.1)

    audioManager.bgmAudio.paused = true
    audioManager.setMuted(false)

    expect(audioManager.isMuted).toBe(false)
    expect(audioManager.bgmAudio.muted).toBe(false)
    expect(gainNode.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.8, 12, 0.1)
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('advances to the next background track when playback ends', async () => {
    const { audioManager } = await loadAudioManager()
    audioManager.init()

    audioManager.bgmAudio.dispatch('ended')

    expect(audioManager.currentBgmIndex).toBe(1)
    expect(audioManager.bgmAudio.src).toBe('/bgm2.mp3')
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('plays the synthesized laser effect only when active and unmuted', async () => {
    const { audioManager } = await loadAudioManager()

    audioManager.playLaserSound()
    expect(oscillatorNode.start).not.toHaveBeenCalled()

    audioManager.init()
    audioManager.playLaserSound()

    expect(oscillatorNode.type).toBe('square')
    expect(oscillatorNode.frequency.setValueAtTime).toHaveBeenCalledWith(800, 12)
    expect(oscillatorNode.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(100, 12.15)
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.02, 12.01)
    expect(oscillatorNode.start).toHaveBeenCalledWith(12)
    expect(oscillatorNode.stop).toHaveBeenCalledWith(12.15)
  })
})
