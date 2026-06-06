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
      console.log('[Storage] 发送通知:', title, body)

      if (isElectron()) {
        console.log('[Storage] 使用 Electron 通知')
        await window.api!.notify(title, body)
      }

      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          console.log('[Storage] 使用浏览器通知')
          const notification = new Notification(title, {
            body,
            icon: '/bell.png',
            badge: '/bell.png'
          })

          notification.onclick = () => {
            console.log('[Storage] 通知被点击')
            window.focus()
            notification.close()
          }

          setTimeout(() => {
            notification.close()
          }, 10000)
        } else {
          console.log('[Storage] 浏览器通知权限:', Notification.permission)
        }
      }
    } catch (err) {
      console.error('[Storage] 发送通知失败:', err)
    }
  },

  async requestNotificationPermission(): Promise<NotificationPermission | null> {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        console.log('[Storage] 请求通知权限...')
        const permission = await Notification.requestPermission()
        console.log('[Storage] 通知权限结果:', permission)
        return permission
      }
      return Notification.permission || null
    } catch (err) {
      console.error('[Storage] 请求通知权限失败:', err)
      return null
    }
  }
}
