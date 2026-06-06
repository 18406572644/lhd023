import type { Task, TaskHistory } from '../types'

const TASKS_KEY = 'task_reminder_tasks'
const HISTORY_KEY = 'task_reminder_history'

declare global {
  interface Window {
    api?: {
      store: {
        get: (key: string) => Promise<any>
        set: (key: string, value: any) => Promise<boolean>
        delete: (key: string) => Promise<boolean>
      }
      notify: (title: string, body: string) => Promise<boolean>
      quit: () => Promise<void>
    }
  }
}

const isElectron = () => {
  return typeof window !== 'undefined' && window.api !== undefined
}

export const storage = {
  async getTasks(): Promise<Task[]> {
    try {
      if (isElectron()) {
        const data = await window.api!.store.get(TASKS_KEY)
        if (data) return data
      }
      const localData = localStorage.getItem(TASKS_KEY)
      return localData ? JSON.parse(localData) : []
    } catch {
      return []
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
      if (isElectron()) {
        await window.api!.store.set(TASKS_KEY, tasks)
      }
    } catch {
      // ignore
    }
  },

  async getHistory(): Promise<TaskHistory[]> {
    try {
      if (isElectron()) {
        const data = await window.api!.store.get(HISTORY_KEY)
        if (data) return data
      }
      const localData = localStorage.getItem(HISTORY_KEY)
      return localData ? JSON.parse(localData) : []
    } catch {
      return []
    }
  },

  async saveHistory(history: TaskHistory[]): Promise<void> {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      if (isElectron()) {
        await window.api!.store.set(HISTORY_KEY, history)
      }
    } catch {
      // ignore
    }
  },

  async notify(title: string, body: string): Promise<void> {
    try {
      if (isElectron()) {
        await window.api!.notify(title, body)
      } else if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body })
        } else if (Notification.permission !== 'denied') {
          const permission = await Notification.requestPermission()
          if (permission === 'granted') {
            new Notification(title, { body })
          }
        }
      }
    } catch {
      // ignore
    }
  }
}
