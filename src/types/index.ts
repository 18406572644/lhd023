export type TaskRepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'

export type SoundType = 'gentle' | 'cheerful' | 'urgent' | 'classic' | 'chime' | 'custom'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskTag = 'work' | 'personal' | 'family' | 'health' | 'study' | 'other'

export interface SoundOption {
  id: string
  name: string
  type: SoundType
  description: string
  isBuiltIn: boolean
  data?: string
  fileName?: string
}

export interface AppSettings {
  defaultSoundId: string
  sounds: SoundOption[]
}

export interface Task {
  id: string
  title: string
  description: string
  targetTime: string
  repeatType: TaskRepeatType
  repeatInterval?: number
  repeatDays?: number[]
  enabled: boolean
  createdAt: string
  soundEnabled: boolean
  soundId?: string
  priority: TaskPriority
  tag: TaskTag
  duration?: number
}

export interface TaskHistory {
  id: string
  taskId: string
  taskTitle: string
  triggeredAt: string
  status: 'completed' | 'skipped' | 'failed'
}

export interface AppState {
  tasks: Task[]
  history: TaskHistory[]
}
