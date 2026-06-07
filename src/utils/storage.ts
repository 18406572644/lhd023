import type { Task, TaskHistory, HotkeyConfig } from '../types'

const TASKS_KEY = 'task_reminder_tasks'
const HISTORY_KEY = 'task_reminder_history'
const HOTKEYS_KEY = 'task_reminder_hotkeys'

export const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  {
    id: 'quick-create-task',
    name: '快速创建任务',
    description: '在任何界面下快速唤起任务创建窗口',
    defaultAccelerator: 'Ctrl+Alt+N',
    accelerator: 'Ctrl+Alt+N',
    enabled: true
  }
]

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
      hotkeys?: {
        register: (accelerator: string, hotkeyId: string) => Promise<boolean>
        unregister: (accelerator: string) => Promise<void>
        unregisterAll: () => Promise<void>
        onTrigger: (callback: (hotkeyId: string) => void) => () => void
      }
    }
  }
}

const isElectron = () => {
  return typeof window !== 'undefined' && window.api !== undefined
}

const migrateTask = (task: any): Task => {
  return {
    priority: 'medium',
    tag: 'other',
    duration: 30,
    ...task
  }
}

export const storage = {
  async getTasks(): Promise<Task[]> {
    try {
      let tasks: any[] = []
      if (isElectron()) {
        const data = await window.api!.store.get(TASKS_KEY)
        if (data) tasks = data
      } else {
        const localData = localStorage.getItem(TASKS_KEY)
        if (localData) tasks = JSON.parse(localData)
      }
      return tasks.map(migrateTask)
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
  },

  async getHotkeys(): Promise<HotkeyConfig[]> {
    try {
      let hotkeys: HotkeyConfig[] = []
      if (isElectron()) {
        const data = await window.api!.store.get(HOTKEYS_KEY)
        if (data) hotkeys = data
      } else {
        const localData = localStorage.getItem(HOTKEYS_KEY)
        if (localData) hotkeys = JSON.parse(localData)
      }
      if (hotkeys.length === 0) {
        return [...DEFAULT_HOTKEYS]
      }
      return hotkeys
    } catch {
      return [...DEFAULT_HOTKEYS]
    }
  },

  async saveHotkeys(hotkeys: HotkeyConfig[]): Promise<void> {
    try {
      localStorage.setItem(HOTKEYS_KEY, JSON.stringify(hotkeys))
      if (isElectron()) {
        await window.api!.store.set(HOTKEYS_KEY, hotkeys)
      }
    } catch {
      // ignore
    }
  },

  async registerHotkey(accelerator: string, hotkeyId: string): Promise<boolean> {
    try {
      if (isElectron() && window.api!.hotkeys?.register) {
        return await window.api!.hotkeys.register(accelerator, hotkeyId)
      }
      return false
    } catch (err) {
      console.error('[Storage] 注册热键失败:', err)
      return false
    }
  },

  async unregisterHotkey(accelerator: string): Promise<void> {
    try {
      if (isElectron() && window.api!.hotkeys?.unregister) {
        await window.api!.hotkeys.unregister(accelerator)
      }
    } catch (err) {
      console.error('[Storage] 注销热键失败:', err)
    }
  },

  async unregisterAllHotkeys(): Promise<void> {
    try {
      if (isElectron() && window.api!.hotkeys?.unregisterAll) {
        await window.api!.hotkeys.unregisterAll()
      }
    } catch (err) {
      console.error('[Storage] 注销所有热键失败:', err)
    }
  }
}
