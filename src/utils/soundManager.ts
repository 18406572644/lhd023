import type { SoundOption, SoundType, AppSettings } from '../types'
import { DEFAULT_HOTKEYS } from './storage'

const SETTINGS_KEY = 'task_reminder_settings'

export const builtInSounds: SoundOption[] = [
  {
    id: 'gentle',
    name: '轻柔',
    type: 'gentle',
    description: '柔和的铃声，适合日常提醒',
    isBuiltIn: true
  },
  {
    id: 'cheerful',
    name: '欢快',
    type: 'cheerful',
    description: '轻松愉快的铃声，带来好心情',
    isBuiltIn: true
  },
  {
    id: 'urgent',
    name: '急促',
    type: 'urgent',
    description: '紧迫感强的铃声，适合重要事项',
    isBuiltIn: true
  },
  {
    id: 'classic',
    name: '经典',
    type: 'classic',
    description: '传统的叮咚铃声',
    isBuiltIn: true
  },
  {
    id: 'chime',
    name: '风铃',
    type: 'chime',
    description: '清脆的风铃声，优雅动听',
    isBuiltIn: true
  }
]

type PlayStateChangeListener = (soundId: string | null, isPlaying: boolean) => void

class SoundPlayer {
  private customAudio: HTMLAudioElement | null = null
  private audioContext: AudioContext | null = null
  private activeOscillators: { oscillator: OscillatorNode; gainNode: GainNode }[] = []
  private currentSoundId: string | null = null
  private currentSoundType: SoundType | null = null
  private isPlayingFlag = false
  private listeners: Set<PlayStateChangeListener> = new Set()

  subscribe(listener: PlayStateChangeListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      listener(this.currentSoundId, this.isPlayingFlag)
    })
  }

  getCurrentSoundId(): string | null {
    return this.currentSoundId
  }

  isPlaying(): boolean {
    return this.isPlayingFlag
  }

  isPlayingSound(soundId: string): boolean {
    return this.isPlayingFlag && this.currentSoundId === soundId
  }

  private async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  private stopAllBuiltInSounds() {
    this.activeOscillators.forEach(({ oscillator, gainNode }) => {
      try {
        gainNode.gain.cancelScheduledValues(this.audioContext!.currentTime)
        gainNode.gain.setValueAtTime(gainNode.gain.value, this.audioContext!.currentTime)
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + 0.05)
        oscillator.stop(this.audioContext!.currentTime + 0.05)
      } catch {
        try {
          oscillator.stop()
        } catch {
          // ignore
        }
      }
    })
    this.activeOscillators = []
  }

  private stopCustomAudio() {
    if (this.customAudio) {
      this.customAudio.pause()
      this.customAudio.currentTime = 0
      this.customAudio.src = ''
      this.customAudio = null
    }
  }

  stopAll() {
    if (this.currentSoundType === 'custom') {
      this.stopCustomAudio()
    } else if (this.currentSoundType) {
      this.stopAllBuiltInSounds()
      if (this.audioContext) {
        this.audioContext.close().catch(() => {})
        this.audioContext = null
      }
    }

    const wasPlaying = this.isPlayingFlag
    this.isPlayingFlag = false
    this.currentSoundId = null
    this.currentSoundType = null

    if (wasPlaying) {
      this.notifyListeners()
    }
  }

  pause() {
    if (!this.isPlayingFlag) return

    if (this.currentSoundType === 'custom' && this.customAudio) {
      this.customAudio.pause()
    } else if (this.currentSoundType) {
      this.stopAllBuiltInSounds()
      if (this.audioContext) {
        this.audioContext.suspend().catch(() => {})
      }
    }

    this.isPlayingFlag = false
    this.notifyListeners()
  }

  async play(soundOption: SoundOption): Promise<void> {
    if (this.currentSoundId === soundOption.id && this.isPlayingFlag) {
      return
    }

    this.stopAll()

    this.currentSoundId = soundOption.id
    this.currentSoundType = soundOption.type

    try {
      if (soundOption.data) {
        await this.playCustomSound(soundOption.data, soundOption.id)
      } else {
        await this.playBuiltInSound(soundOption.type)
      }
    } catch {
      this.stopAll()
      try {
        await this.playBuiltInSound('gentle')
      } catch {
        this.stopAll()
      }
    }
  }

  async toggle(soundOption: SoundOption): Promise<void> {
    if (this.currentSoundId === soundOption.id && this.isPlayingFlag) {
      this.pause()
    } else {
      await this.play(soundOption)
    }
  }

  private async playCustomSound(dataUrl: string, soundId: string): Promise<void> {
    const audio = new Audio(dataUrl)
    audio.volume = 0.8
    this.customAudio = audio

    audio.onended = () => {
      if (this.currentSoundId === soundId) {
        this.isPlayingFlag = false
        this.currentSoundId = null
        this.currentSoundType = null
        this.notifyListeners()
      }
    }

    audio.onpause = () => {
      if (this.currentSoundId === soundId && this.isPlayingFlag) {
        this.isPlayingFlag = false
        this.notifyListeners()
      }
    }

    audio.onplay = () => {
      if (this.currentSoundId === soundId) {
        this.isPlayingFlag = true
        this.notifyListeners()
      }
    }

    audio.onerror = () => {
      if (this.currentSoundId === soundId) {
        this.stopAll()
      }
    }

    try {
      await audio.play()
      this.isPlayingFlag = true
      this.notifyListeners()
    } catch (err) {
      this.stopAll()
      throw err
    }
  }

  private async playBuiltInSound(type: SoundType): Promise<void> {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) {
      throw new Error('AudioContext not supported')
    }

    this.audioContext = new AudioContextCtor()
    await this.resumeAudioContext()

    const playTone = (frequency: number, startTime: number, duration: number, volume: number = 0.3, oscillatorType: OscillatorType = 'sine') => {
      if (!this.audioContext) return

      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = oscillatorType

      const now = startTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.02)
      gainNode.gain.linearRampToValueAtTime(0, now + duration)

      oscillator.start(now)
      oscillator.stop(now + duration)

      this.activeOscillators.push({ oscillator, gainNode })

      oscillator.onended = () => {
        const index = this.activeOscillators.findIndex(o => o.oscillator === oscillator)
        if (index !== -1) {
          this.activeOscillators.splice(index, 1)
        }
        if (this.activeOscillators.length === 0 && this.currentSoundType !== 'custom') {
          if (this.audioContext) {
            this.audioContext.close().catch(() => {})
            this.audioContext = null
          }
          if (this.isPlayingFlag) {
            this.isPlayingFlag = false
            this.currentSoundId = null
            this.currentSoundType = null
            this.notifyListeners()
          }
        }
      }
    }

    if (!this.audioContext) {
      throw new Error('Failed to create AudioContext')
    }

    const now = this.audioContext.currentTime
    this.isPlayingFlag = true
    this.notifyListeners()

    switch (type) {
      case 'gentle':
        playTone(523, now, 0.25, 0.2)
        playTone(659, now + 0.3, 0.25, 0.2)
        playTone(784, now + 0.6, 0.4, 0.2)
        break
      case 'cheerful':
        playTone(523, now, 0.15, 0.25)
        playTone(659, now + 0.15, 0.15, 0.25)
        playTone(784, now + 0.3, 0.15, 0.25)
        playTone(1047, now + 0.45, 0.3, 0.3)
        break
      case 'urgent':
        playTone(880, now, 0.1, 0.35)
        playTone(880, now + 0.15, 0.1, 0.35)
        playTone(1100, now + 0.3, 0.1, 0.35)
        playTone(880, now + 0.45, 0.1, 0.35)
        playTone(880, now + 0.6, 0.1, 0.35)
        playTone(1100, now + 0.75, 0.15, 0.4)
        break
      case 'classic':
        playTone(880, now, 0.15, 0.3)
        playTone(880, now + 0.25, 0.15, 0.3)
        playTone(1100, now + 0.5, 0.3, 0.35)
        break
      case 'chime':
        playTone(1319, now, 0.15, 0.2, 'triangle')
        playTone(1568, now + 0.2, 0.15, 0.2, 'triangle')
        playTone(2093, now + 0.4, 0.5, 0.25, 'triangle')
        break
      default:
        playTone(880, now, 0.15, 0.3)
        playTone(880, now + 0.25, 0.15, 0.3)
        playTone(1100, now + 0.5, 0.3, 0.35)
    }
  }
}

const soundPlayer = new SoundPlayer()

const getDefaultSettings = (): AppSettings => ({
  defaultSoundId: 'gentle',
  sounds: [...builtInSounds],
  hotkeys: [...DEFAULT_HOTKEYS],
  widget: {
    enabled: false,
    size: 'medium',
    opacity: 0.9,
    position: { x: 100, y: 100 },
    alwaysOnTop: true
  }
})

export const soundManager = {
  player: soundPlayer,

  async getSettings(): Promise<AppSettings> {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        const settings = JSON.parse(stored)
        const existingIds = new Set(settings.sounds.map((s: SoundOption) => s.id))
        const missingBuiltIns = builtInSounds.filter(s => !existingIds.has(s.id))
        return {
          ...settings,
          sounds: [...missingBuiltIns, ...settings.sounds]
        }
      }
    } catch {
      // ignore
    }
    return getDefaultSettings()
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // ignore
    }
  },

  async getDefaultSoundId(): Promise<string> {
    const settings = await this.getSettings()
    return settings.defaultSoundId
  },

  async setDefaultSoundId(soundId: string): Promise<void> {
    const settings = await this.getSettings()
    settings.defaultSoundId = soundId
    await this.saveSettings(settings)
  },

  async getAllSounds(): Promise<SoundOption[]> {
    const settings = await this.getSettings()
    return settings.sounds
  },

  async getSoundById(soundId: string): Promise<SoundOption | undefined> {
    const sounds = await this.getAllSounds()
    return sounds.find(s => s.id === soundId)
  },

  async addCustomSound(file: File): Promise<SoundOption | null> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = e.target?.result as string
        if (!data) {
          resolve(null)
          return
        }

        const newSound: SoundOption = {
          id: 'custom_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: 'custom',
          description: '自定义铃声',
          isBuiltIn: false,
          data,
          fileName: file.name
        }

        const settings = await this.getSettings()
        settings.sounds.push(newSound)
        await this.saveSettings(settings)
        resolve(newSound)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  },

  async deleteCustomSound(soundId: string): Promise<boolean> {
    const settings = await this.getSettings()
    const soundIndex = settings.sounds.findIndex(s => s.id === soundId)
    if (soundIndex === -1 || settings.sounds[soundIndex].isBuiltIn) {
      return false
    }

    if (soundPlayer.getCurrentSoundId() === soundId) {
      soundPlayer.stopAll()
    }

    settings.sounds.splice(soundIndex, 1)
    if (settings.defaultSoundId === soundId) {
      settings.defaultSoundId = 'gentle'
    }

    const tasks = JSON.parse(localStorage.getItem('task_reminder_tasks') || '[]')
    const updatedTasks = tasks.map((task: any) => {
      if (task.soundId === soundId) {
        return { ...task, soundId: undefined }
      }
      return task
    })
    localStorage.setItem('task_reminder_tasks', JSON.stringify(updatedTasks))

    await this.saveSettings(settings)
    return true
  },

  async updateSoundName(soundId: string, name: string): Promise<boolean> {
    const settings = await this.getSettings()
    const sound = settings.sounds.find(s => s.id === soundId)
    if (!sound || sound.isBuiltIn) {
      return false
    }
    sound.name = name
    await this.saveSettings(settings)
    return true
  },

  playSound(soundOption: SoundOption): void {
    soundPlayer.play(soundOption).catch(() => {})
  },

  toggleSound(soundOption: SoundOption): void {
    soundPlayer.toggle(soundOption).catch(() => {})
  },

  pauseSound(): void {
    soundPlayer.pause()
  },

  stopSound(): void {
    soundPlayer.stopAll()
  },

  isPlayingSound(soundId: string): boolean {
    return soundPlayer.isPlayingSound(soundId)
  },

  getCurrentPlayingSoundId(): string | null {
    return soundPlayer.getCurrentSoundId()
  },

  subscribeToPlayState(listener: PlayStateChangeListener) {
    return soundPlayer.subscribe(listener)
  },

  async playTaskSound(task: { soundId?: string; soundEnabled: boolean }): Promise<void> {
    if (!task.soundEnabled) return

    const soundId = task.soundId || await this.getDefaultSoundId()
    const sound = await this.getSoundById(soundId)
    if (sound) {
      await soundPlayer.play(sound)
    }
  }
}
