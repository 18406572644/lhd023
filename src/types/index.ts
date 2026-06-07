export type TaskRepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'

export type SoundType = 'gentle' | 'cheerful' | 'urgent' | 'classic' | 'chime' | 'custom'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskTag = 'work' | 'personal' | 'family' | 'health' | 'study' | 'other'

export type TemplateCategory = 'meeting' | 'report' | 'health' | 'study' | 'personal' | 'work' | 'other'

export interface TaskTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  taskTitle: string
  taskDescription: string
  targetTime: string
  repeatType: TaskRepeatType
  repeatInterval?: number
  repeatDays?: number[]
  soundEnabled: boolean
  soundId?: string
  priority: TaskPriority
  tag: TaskTag
  duration?: number
  isBuiltIn: boolean
  createdAt: string
}

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

export interface TaskLink {
  id: string
  title: string
  url: string
  createdAt: string
}

export interface TaskAttachment {
  id: string
  name: string
  path: string
  size?: number
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  notes: string
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
  links: TaskLink[]
  attachments: TaskAttachment[]
  isPinned: boolean
  pinnedAt?: string
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

export interface HotkeyConfig {
  id: string
  name: string
  description: string
  defaultAccelerator: string
  accelerator: string
  enabled: boolean
}

export type WidgetSize = 'small' | 'medium' | 'large'

export interface WidgetPosition {
  x: number
  y: number
}

export interface WidgetConfig {
  enabled: boolean
  size: WidgetSize
  opacity: number
  position: WidgetPosition
  alwaysOnTop: boolean
}

export interface WidgetSizeConfig {
  width: number
  height: number
  maxTasks: number
}

export interface AppSettings {
  defaultSoundId: string
  sounds: SoundOption[]
  hotkeys: HotkeyConfig[]
  widget: WidgetConfig
}
