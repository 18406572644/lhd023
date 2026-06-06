export type TaskRepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'

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
