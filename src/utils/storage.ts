import type { Task, TaskHistory, HotkeyConfig, TaskTemplate, WidgetConfig, WidgetSize } from '../types'
import { generateId } from './scheduler'

const TASKS_KEY = 'task_reminder_tasks'
const HISTORY_KEY = 'task_reminder_history'
const HOTKEYS_KEY = 'task_reminder_hotkeys'
const TEMPLATES_KEY = 'task_reminder_templates'

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

export const BUILT_IN_TEMPLATES: TaskTemplate[] = [
  {
    id: 'builtin-daily-standup',
    name: '每日晨会',
    description: '每日团队站会提醒，同步工作进度',
    category: 'meeting',
    taskTitle: '每日晨会',
    taskDescription: '参加团队每日站会，同步昨日工作进度、今日工作计划和遇到的问题',
    targetTime: '09:30',
    repeatType: 'daily',
    soundEnabled: true,
    priority: 'high',
    tag: 'work',
    duration: 30,
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'builtin-weekly-report',
    name: '周报提交',
    description: '每周五提交周报',
    category: 'report',
    taskTitle: '提交周报',
    taskDescription: '整理本周工作总结，填写周报并提交给领导',
    targetTime: '17:00',
    repeatType: 'weekly',
    repeatDays: [5],
    soundEnabled: true,
    priority: 'high',
    tag: 'work',
    duration: 60,
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'builtin-daily-exercise',
    name: '每日运动',
    description: '提醒自己每天保持运动',
    category: 'health',
    taskTitle: '运动健身',
    taskDescription: '进行30分钟的运动锻炼，保持身体健康',
    targetTime: '19:00',
    repeatType: 'daily',
    soundEnabled: true,
    priority: 'medium',
    tag: 'health',
    duration: 30,
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'builtin-daily-drink-water',
    name: '喝水提醒',
    description: '定时喝水，保持水分摄入',
    category: 'health',
    taskTitle: '喝水提醒',
    taskDescription: '喝一杯水，补充身体水分',
    targetTime: '10:00',
    repeatType: 'custom',
    repeatInterval: 120,
    soundEnabled: true,
    priority: 'low',
    tag: 'health',
    duration: 5,
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'builtin-monthly-review',
    name: '月度总结',
    description: '每月底进行工作总结和下月规划',
    category: 'report',
    taskTitle: '月度总结与规划',
    taskDescription: '总结本月工作完成情况，制定下月工作计划',
    targetTime: '16:00',
    repeatType: 'monthly',
    soundEnabled: true,
    priority: 'high',
    tag: 'work',
    duration: 120,
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'builtin-daily-study',
    name: '每日学习',
    description: '每天安排时间学习新知识',
    category: 'study',
    taskTitle: '学习时间',
    taskDescription: '专注学习，提升自己的知识和技能',
    targetTime: '21:00',
    repeatType: 'daily',
    soundEnabled: true,
    priority: 'medium',
    tag: 'study',
    duration: 60,
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'builtin-team-meeting',
    name: '周会',
    description: '每周团队周会',
    category: 'meeting',
    taskTitle: '团队周会',
    taskDescription: '参加团队周会，讨论重要事项',
    targetTime: '14:00',
    repeatType: 'weekly',
    repeatDays: [1],
    soundEnabled: true,
    priority: 'high',
    tag: 'work',
    duration: 90,
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'builtin-sleep-reminder',
    name: '睡觉提醒',
    description: '提醒按时休息，保持良好作息',
    category: 'health',
    taskTitle: '准备睡觉',
    taskDescription: '放下手机，准备休息，保证充足睡眠',
    targetTime: '23:00',
    repeatType: 'daily',
    soundEnabled: true,
    priority: 'medium',
    tag: 'health',
    duration: 10,
    isBuiltIn: true,
    createdAt: new Date().toISOString()
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
      file?: {
        select: (options?: {
          title?: string
          multiple?: boolean
          filters?: { name: string; extensions: string[] }[]
        }) => Promise<{ name: string; path: string; size: number | null } | { name: string; path: string; size: number | null }[] | null>
        open: (filePath: string) => Promise<boolean>
        showInFolder: (filePath: string) => Promise<boolean>
      }
      widget?: {
        getConfig: () => Promise<WidgetConfig>
        saveConfig: (config: WidgetConfig) => Promise<boolean>
        show: () => Promise<boolean>
        hide: () => Promise<boolean>
        toggle: () => Promise<boolean>
        setSize: (size: WidgetSize) => Promise<boolean>
        setOpacity: (opacity: number) => Promise<boolean>
        setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<boolean>
        showMainWindow: () => Promise<boolean>
        close: () => Promise<boolean>
        broadcastTaskUpdate: () => Promise<boolean>
        onTaskUpdateRequested: (callback: () => void) => () => void
      }
      windowFlash?: {
        flashTaskbar: (critical?: boolean) => Promise<boolean>
        stopFlash: () => Promise<boolean>
      }
      windowState?: {
        setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<boolean>
        setFullScreen: (fullscreen: boolean) => Promise<boolean>
        focus: () => Promise<boolean>
        show: () => Promise<boolean>
      }
      notificationBadge?: {
        setBadge: (count: number) => Promise<boolean>
        clearBadge: () => Promise<boolean>
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
    notes: '',
    links: [],
    attachments: [],
    isPinned: false,
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
  },

  async getTemplates(): Promise<TaskTemplate[]> {
    try {
      let templates: TaskTemplate[] = []
      if (isElectron()) {
        const data = await window.api!.store.get(TEMPLATES_KEY)
        if (data) templates = data
      } else {
        const localData = localStorage.getItem(TEMPLATES_KEY)
        if (localData) templates = JSON.parse(localData)
      }
      return [...BUILT_IN_TEMPLATES, ...templates]
    } catch {
      return [...BUILT_IN_TEMPLATES]
    }
  },

  async saveTemplates(templates: TaskTemplate[]): Promise<void> {
    try {
      const customTemplates = templates.filter(t => !t.isBuiltIn)
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(customTemplates))
      if (isElectron()) {
        await window.api!.store.set(TEMPLATES_KEY, customTemplates)
      }
    } catch {
      // ignore
    }
  },

  async addTemplate(template: Omit<TaskTemplate, 'id' | 'createdAt' | 'isBuiltIn'>): Promise<TaskTemplate> {
    const templates = await this.getTemplates()
    const newTemplate: TaskTemplate = {
      ...template,
      id: generateId(),
      createdAt: new Date().toISOString(),
      isBuiltIn: false
    }
    await this.saveTemplates([...templates, newTemplate])
    return newTemplate
  },

  async updateTemplate(id: string, updates: Partial<TaskTemplate>): Promise<void> {
    const templates = await this.getTemplates()
    const updatedTemplates = templates.map(t =>
      t.id === id ? { ...t, ...updates } : t
    )
    await this.saveTemplates(updatedTemplates)
  },

  async deleteTemplate(id: string): Promise<void> {
    const templates = await this.getTemplates()
    const filteredTemplates = templates.filter(t => t.id !== id)
    await this.saveTemplates(filteredTemplates)
  },

  async createTaskFromTemplate(templateId: string): Promise<Omit<Task, 'id' | 'createdAt'> | null> {
    const templates = await this.getTemplates()
    const template = templates.find(t => t.id === templateId)
    if (!template) return null

    const now = new Date()
    const [hours, minutes] = template.targetTime.split(':').map(Number)
    const targetDate = new Date()
    targetDate.setHours(hours, minutes, 0, 0)
    if (targetDate <= now) {
      if (template.repeatType === 'daily') {
        targetDate.setDate(targetDate.getDate() + 1)
      } else if (template.repeatType === 'weekly' && template.repeatDays?.length) {
        const today = targetDate.getDay()
        const nextDay = template.repeatDays.find(d => d > today) ?? template.repeatDays[0]
        const daysToAdd = nextDay > today ? nextDay - today : (7 - today + nextDay)
        targetDate.setDate(targetDate.getDate() + daysToAdd)
      } else if (template.repeatType === 'monthly') {
        targetDate.setMonth(targetDate.getMonth() + 1)
      } else {
        targetDate.setDate(targetDate.getDate() + 1)
      }
    }

    return {
      title: template.taskTitle,
      description: template.taskDescription,
      targetTime: targetDate.toISOString(),
      repeatType: template.repeatType,
      repeatInterval: template.repeatInterval,
      repeatDays: template.repeatDays,
      enabled: true,
      soundEnabled: template.soundEnabled,
      soundId: template.soundId,
      priority: template.priority,
      tag: template.tag,
      duration: template.duration,
      notes: '',
      links: [],
      attachments: [],
      isPinned: false
    }
  },

  async getWidgetConfig(): Promise<WidgetConfig> {
    const defaultConfig: WidgetConfig = {
      enabled: false,
      size: 'medium',
      opacity: 0.9,
      position: { x: 100, y: 100 },
      alwaysOnTop: true
    }
    try {
      if (isElectron() && window.api?.widget?.getConfig) {
        return await window.api.widget.getConfig()
      }
      const localData = localStorage.getItem('widget_config')
      return localData ? { ...defaultConfig, ...JSON.parse(localData) } : defaultConfig
    } catch {
      return defaultConfig
    }
  },

  async saveWidgetConfig(config: WidgetConfig): Promise<void> {
    try {
      localStorage.setItem('widget_config', JSON.stringify(config))
      if (isElectron() && window.api?.widget?.saveConfig) {
        await window.api.widget.saveConfig(config)
      }
    } catch {
      // ignore
    }
  },

  async showWidget(): Promise<boolean> {
    try {
      if (isElectron() && window.api?.widget?.show) {
        return await window.api.widget.show()
      }
      return false
    } catch {
      return false
    }
  },

  async hideWidget(): Promise<boolean> {
    try {
      if (isElectron() && window.api?.widget?.hide) {
        return await window.api.widget.hide()
      }
      return false
    } catch {
      return false
    }
  },

  async toggleWidget(): Promise<boolean> {
    try {
      if (isElectron() && window.api?.widget?.toggle) {
        return await window.api.widget.toggle()
      }
      return false
    } catch {
      return false
    }
  },

  async setWidgetSize(size: WidgetSize): Promise<boolean> {
    try {
      if (isElectron() && window.api?.widget?.setSize) {
        return await window.api.widget.setSize(size)
      }
      return false
    } catch {
      return false
    }
  },

  async setWidgetOpacity(opacity: number): Promise<boolean> {
    try {
      if (isElectron() && window.api?.widget?.setOpacity) {
        return await window.api.widget.setOpacity(opacity)
      }
      return false
    } catch {
      return false
    }
  },

  async broadcastTaskUpdate(): Promise<void> {
    try {
      if (isElectron() && window.api?.widget?.broadcastTaskUpdate) {
        await window.api.widget.broadcastTaskUpdate()
      }
    } catch {
      // ignore
    }
  }
}
