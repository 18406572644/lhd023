import type { SoundOption, SoundType, AppSettings } from '../types'

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

const getDefaultSettings = (): AppSettings => ({
  defaultSoundId: 'gentle',
  sounds: [...builtInSounds]
})

export const soundManager = {
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
    try {
      if (soundOption.data) {
        const audio = new Audio(soundOption.data)
        audio.volume = 0.8
        audio.play().catch(() => {
          this.playBuiltInSound(soundOption.type)
        })
        return
      }
      this.playBuiltInSound(soundOption.type)
    } catch {
      this.playBuiltInSound('gentle')
    }
  },

  playBuiltInSound(type: SoundType): void {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContext) return

      const audioContext = new AudioContext()

      const playTone = (frequency: number, startTime: number, duration: number, volume: number = 0.3, type: OscillatorType = 'sine') => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = type

        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02)
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      }

      const now = audioContext.currentTime

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

      setTimeout(() => {
        audioContext.close()
      }, 2000)
    } catch {
      // ignore
    }
  },

  async playTaskSound(task: { soundId?: string; soundEnabled: boolean }): Promise<void> {
    if (!task.soundEnabled) return

    const soundId = task.soundId || await this.getDefaultSoundId()
    const sound = await this.getSoundById(soundId)
    if (sound) {
      this.playSound(sound)
    }
  }
}
