import type { Task, TaskHistory, HotkeyConfig, TaskTemplate, WidgetConfig, WidgetSize, VocabMapping, NLPLearningData, CalendarAccount, Calendar, CalendarEvent, CalendarSyncConfig, CalendarConflict, TimeSlot, Objective, KeyResult, OKRMilestoneNotification } from '../types'
import { generateId } from './scheduler'
import { updateWordFrequency } from './nlpParser'

const TASKS_KEY = 'task_reminder_tasks'
const HISTORY_KEY = 'task_reminder_history'
const HOTKEYS_KEY = 'task_reminder_hotkeys'
const TEMPLATES_KEY = 'task_reminder_templates'
const VOCAB_KEY = 'task_reminder_vocab_mappings'
const NLP_LEARNING_KEY = 'task_reminder_nlp_learning'
const OBJECTIVES_KEY = 'task_reminder_objectives'
const OKR_NOTIFICATIONS_KEY = 'task_reminder_okr_notifications'

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
      calendar?: {
        getAccounts: () => Promise<CalendarAccount[]>
        saveAccounts: (accounts: CalendarAccount[]) => Promise<boolean>
        getCalendars: () => Promise<Calendar[]>
        saveCalendars: (calendars: Calendar[]) => Promise<boolean>
        getEvents: (startTime?: string, endTime?: string) => Promise<CalendarEvent[]>
        saveEvents: (events: CalendarEvent[]) => Promise<boolean>
        getSyncConfig: () => Promise<CalendarSyncConfig>
        saveSyncConfig: (config: CalendarSyncConfig) => Promise<boolean>
        sync: () => Promise<{ success: boolean; message: string; eventsCount?: number; calendarsCount?: number }>
        createEvent: (eventData: Partial<CalendarEvent>) => Promise<{ success: boolean; event?: CalendarEvent; message?: string }>
        updateEvent: (eventId: string, updates: Partial<CalendarEvent>) => Promise<{ success: boolean; event?: CalendarEvent; message?: string }>
        deleteEvent: (eventId: string) => Promise<{ success: boolean; message?: string }>
        getBusySlots: (startTime: string, endTime: string) => Promise<CalendarEvent[]>
        suggestFreeTime: (preferredDate: string, durationMinutes?: number) => Promise<TimeSlot[]>
        checkConflicts: (taskStartTime: string, taskEndTime: string, taskId?: string) => Promise<CalendarConflict[]>
        openMeetingUrl: (url: string) => Promise<boolean>
        findMeetingUrl: (text: string) => Promise<{ url: string; provider: string } | null>
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
  },

  async getVocabMappings(): Promise<VocabMapping[]> {
    try {
      let mappings: VocabMapping[] = []
      if (isElectron()) {
        const data = await window.api!.store.get(VOCAB_KEY)
        if (data) mappings = data
      } else {
        const localData = localStorage.getItem(VOCAB_KEY)
        if (localData) mappings = JSON.parse(localData)
      }
      return mappings
    } catch {
      return []
    }
  },

  async saveVocabMappings(mappings: VocabMapping[]): Promise<void> {
    try {
      localStorage.setItem(VOCAB_KEY, JSON.stringify(mappings))
      if (isElectron()) {
        await window.api!.store.set(VOCAB_KEY, mappings)
      }
    } catch {
      // ignore
    }
  },

  async addVocabMapping(mapping: Omit<VocabMapping, 'id' | 'createdAt' | 'usageCount'>): Promise<VocabMapping> {
    const mappings = await this.getVocabMappings()
    const existingIndex = mappings.findIndex(m => m.word === mapping.word && m.category === mapping.category)
    
    if (existingIndex >= 0) {
      const updated = { ...mappings[existingIndex], ...mapping, usageCount: mappings[existingIndex].usageCount + 1 }
      mappings[existingIndex] = updated
      await this.saveVocabMappings(mappings)
      return updated
    }

    const newMapping: VocabMapping = {
      ...mapping,
      id: generateId(),
      createdAt: new Date().toISOString(),
      usageCount: 1
    }
    await this.saveVocabMappings([...mappings, newMapping])
    return newMapping
  },

  async updateVocabMapping(id: string, updates: Partial<VocabMapping>): Promise<void> {
    const mappings = await this.getVocabMappings()
    const updatedMappings = mappings.map(m =>
      m.id === id ? { ...m, ...updates } : m
    )
    await this.saveVocabMappings(updatedMappings)
  },

  async deleteVocabMapping(id: string): Promise<void> {
    const mappings = await this.getVocabMappings()
    const filteredMappings = mappings.filter(m => m.id !== id)
    await this.saveVocabMappings(filteredMappings)
  },

  async getNLPLearningData(): Promise<NLPLearningData> {
    const defaultData: NLPLearningData = {
      vocabMappings: [],
      wordFrequency: {},
      successfulParses: 0,
      totalParses: 0
    }
    try {
      if (isElectron()) {
        const data = await window.api!.store.get(NLP_LEARNING_KEY)
        if (data) return { ...defaultData, ...data }
      }
      const localData = localStorage.getItem(NLP_LEARNING_KEY)
      return localData ? { ...defaultData, ...JSON.parse(localData) } : defaultData
    } catch {
      return defaultData
    }
  },

  async saveNLPLearningData(data: NLPLearningData): Promise<void> {
    try {
      localStorage.setItem(NLP_LEARNING_KEY, JSON.stringify(data))
      if (isElectron()) {
        await window.api!.store.set(NLP_LEARNING_KEY, data)
      }
    } catch {
      // ignore
    }
  },

  async recordNLPParse(input: string, success: boolean): Promise<void> {
    try {
      const data = await this.getNLPLearningData()
      data.totalParses += 1
      if (success) {
        data.successfulParses += 1
      }
      data.wordFrequency = updateWordFrequency(input, data.wordFrequency)
      await this.saveNLPLearningData(data)
    } catch {
      // ignore
    }
  },

  async incrementVocabUsage(word: string, category: VocabMapping['category']): Promise<void> {
    try {
      const mappings = await this.getVocabMappings()
      const mapping = mappings.find(m => m.word === word && m.category === category)
      if (mapping) {
        mapping.usageCount += 1
        await this.saveVocabMappings(mappings)
      }
    } catch {
      // ignore
    }
  },

  async getCalendarAccounts(): Promise<CalendarAccount[]> {
    try {
      if (isElectron() && window.api?.calendar?.getAccounts) {
        return await window.api.calendar.getAccounts()
      }
      return []
    } catch {
      return []
    }
  },

  async saveCalendarAccounts(accounts: CalendarAccount[]): Promise<boolean> {
    try {
      if (isElectron() && window.api?.calendar?.saveAccounts) {
        return await window.api.calendar.saveAccounts(accounts)
      }
      return false
    } catch {
      return false
    }
  },

  async getCalendars(): Promise<Calendar[]> {
    try {
      if (isElectron() && window.api?.calendar?.getCalendars) {
        return await window.api.calendar.getCalendars()
      }
      return []
    } catch {
      return []
    }
  },

  async saveCalendars(calendars: Calendar[]): Promise<boolean> {
    try {
      if (isElectron() && window.api?.calendar?.saveCalendars) {
        return await window.api.calendar.saveCalendars(calendars)
      }
      return false
    } catch {
      return false
    }
  },

  async getCalendarEvents(startTime?: string, endTime?: string): Promise<CalendarEvent[]> {
    try {
      if (isElectron() && window.api?.calendar?.getEvents) {
        return await window.api.calendar.getEvents(startTime, endTime)
      }
      return []
    } catch {
      return []
    }
  },

  async saveCalendarEvents(events: CalendarEvent[]): Promise<boolean> {
    try {
      if (isElectron() && window.api?.calendar?.saveEvents) {
        return await window.api.calendar.saveEvents(events)
      }
      return false
    } catch {
      return false
    }
  },

  async getCalendarSyncConfig(): Promise<CalendarSyncConfig> {
    const defaultConfig: CalendarSyncConfig = {
      enabled: false,
      autoSync: false,
      syncInterval: 30,
      syncAllDayEvents: true,
      syncPastDays: 7,
      syncFutureDays: 30,
      defaultCalendarId: '',
      calendarsToSync: [],
      defaultReminderMinutes: 15,
      conflictDetectionEnabled: true,
      autoSuggestFreeTime: true,
      meetingReminderEnabled: true,
      meetingPrepMinutes: 10
    }
    try {
      if (isElectron() && window.api?.calendar?.getSyncConfig) {
        return await window.api.calendar.getSyncConfig()
      }
      const localData = localStorage.getItem('calendar_sync_config')
      return localData ? { ...defaultConfig, ...JSON.parse(localData) } : defaultConfig
    } catch {
      return defaultConfig
    }
  },

  async saveCalendarSyncConfig(config: CalendarSyncConfig): Promise<boolean> {
    try {
      localStorage.setItem('calendar_sync_config', JSON.stringify(config))
      if (isElectron() && window.api?.calendar?.saveSyncConfig) {
        return await window.api.calendar.saveSyncConfig(config)
      }
      return true
    } catch {
      return false
    }
  },

  async syncCalendar(): Promise<{ success: boolean; message: string; eventsCount?: number; calendarsCount?: number }> {
    try {
      if (isElectron() && window.api?.calendar?.sync) {
        return await window.api.calendar.sync()
      }
      return { success: false, message: '日历同步不可用' }
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  },

  async createCalendarEvent(eventData: Partial<CalendarEvent>): Promise<{ success: boolean; event?: CalendarEvent; message?: string }> {
    try {
      if (isElectron() && window.api?.calendar?.createEvent) {
        return await window.api.calendar.createEvent(eventData)
      }
      return { success: false, message: '创建日历事件不可用' }
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  },

  async updateCalendarEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<{ success: boolean; event?: CalendarEvent; message?: string }> {
    try {
      if (isElectron() && window.api?.calendar?.updateEvent) {
        return await window.api.calendar.updateEvent(eventId, updates)
      }
      return { success: false, message: '更新日历事件不可用' }
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  },

  async deleteCalendarEvent(eventId: string): Promise<{ success: boolean; message?: string }> {
    try {
      if (isElectron() && window.api?.calendar?.deleteEvent) {
        return await window.api.calendar.deleteEvent(eventId)
      }
      return { success: false, message: '删除日历事件不可用' }
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  },

  async getBusySlots(startTime: string, endTime: string): Promise<CalendarEvent[]> {
    try {
      if (isElectron() && window.api?.calendar?.getBusySlots) {
        return await window.api.calendar.getBusySlots(startTime, endTime)
      }
      return []
    } catch {
      return []
    }
  },

  async suggestFreeTime(preferredDate: string, durationMinutes?: number): Promise<TimeSlot[]> {
    try {
      if (isElectron() && window.api?.calendar?.suggestFreeTime) {
        return await window.api.calendar.suggestFreeTime(preferredDate, durationMinutes)
      }
      return []
    } catch {
      return []
    }
  },

  async checkCalendarConflicts(taskStartTime: string, taskEndTime: string, taskId?: string): Promise<CalendarConflict[]> {
    try {
      if (isElectron() && window.api?.calendar?.checkConflicts) {
        return await window.api.calendar.checkConflicts(taskStartTime, taskEndTime, taskId)
      }
      return []
    } catch {
      return []
    }
  },

  async openMeetingUrl(url: string): Promise<boolean> {
    try {
      if (isElectron() && window.api?.calendar?.openMeetingUrl) {
        return await window.api.calendar.openMeetingUrl(url)
      }
      if (typeof window !== 'undefined') {
        window.open(url, '_blank')
        return true
      }
      return false
    } catch {
      return false
    }
  },

  async findMeetingUrl(text: string): Promise<{ url: string; provider: string } | null> {
    try {
      if (isElectron() && window.api?.calendar?.findMeetingUrl) {
        return await window.api.calendar.findMeetingUrl(text)
      }
      const urlRegex = /https?:\/\/[^\s]+/g
      const urls = text.match(urlRegex) || []
      for (const url of urls) {
        const lowerUrl = url.toLowerCase()
        let provider: string | null = null
        if (lowerUrl.includes('zoom.us') || lowerUrl.includes('zoom.com')) provider = 'zoom'
        else if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('microsoft.com')) provider = 'teams'
        else if (lowerUrl.includes('meet.google.com') || lowerUrl.includes('hangouts')) provider = 'meet'
        else if (lowerUrl.includes('webex.com')) provider = 'webex'
        if (provider) return { url, provider }
      }
      return null
    } catch {
      return null
    }
  },

  async syncTaskToCalendar(task: Task): Promise<{ success: boolean; eventId?: string; message?: string }> {
    try {
      const syncConfig = await this.getCalendarSyncConfig()
      if (!syncConfig.enabled) {
        return { success: false, message: '日历同步未启用' }
      }

      const duration = task.duration || 30
      const startTime = task.targetTime
      const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString()

      const eventData: Partial<CalendarEvent> = {
        title: task.title,
        description: task.description || task.notes || '',
        startTime,
        endTime,
        isAllDay: false,
        status: 'busy',
        calendarId: task.calendarSync?.calendarId || syncConfig.defaultCalendarId
      }

      let result
      if (task.calendarSync?.calendarEventId) {
        result = await this.updateCalendarEvent(task.calendarSync.calendarEventId, eventData)
      } else {
        result = await this.createCalendarEvent(eventData)
      }

      return result
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  },

  async getObjectives(): Promise<Objective[]> {
    try {
      let objectives: Objective[] = []
      if (isElectron()) {
        const data = await window.api!.store.get(OBJECTIVES_KEY)
        if (data) objectives = data
      } else {
        const localData = localStorage.getItem(OBJECTIVES_KEY)
        if (localData) objectives = JSON.parse(localData)
      }
      return objectives
    } catch {
      return []
    }
  },

  async saveObjectives(objectives: Objective[]): Promise<void> {
    try {
      localStorage.setItem(OBJECTIVES_KEY, JSON.stringify(objectives))
      if (isElectron()) {
        await window.api!.store.set(OBJECTIVES_KEY, objectives)
      }
    } catch {
      // ignore
    }
  },

  async addObjective(objective: Omit<Objective, 'id' | 'createdAt' | 'updatedAt' | 'keyResults' | 'notifiedMilestones' | 'status'>): Promise<Objective> {
    const objectives = await this.getObjectives()
    const newObjective: Objective = {
      ...objective,
      id: generateId(),
      status: 'not_started',
      keyResults: [],
      notifiedMilestones: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await this.saveObjectives([...objectives, newObjective])
    return newObjective
  },

  async updateObjective(id: string, updates: Partial<Objective>): Promise<void> {
    const objectives = await this.getObjectives()
    const updatedObjectives = objectives.map(o =>
      o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
    )
    await this.saveObjectives(updatedObjectives)
  },

  async deleteObjective(id: string): Promise<void> {
    const objectives = await this.getObjectives()
    const filteredObjectives = objectives.filter(o => o.id !== id)
    await this.saveObjectives(filteredObjectives)
  },

  async addKeyResult(objectiveId: string, kr: Omit<KeyResult, 'id' | 'objectiveId' | 'createdAt' | 'updatedAt'>): Promise<KeyResult> {
    const objectives = await this.getObjectives()
    const newKR: KeyResult = {
      ...kr,
      id: generateId(),
      objectiveId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const updatedObjectives = objectives.map(o => {
      if (o.id === objectiveId) {
        const maxSortOrder = o.keyResults.length > 0 
          ? Math.max(...o.keyResults.map(kr => kr.sortOrder)) 
          : -1
        return {
          ...o,
          keyResults: [...o.keyResults, { ...newKR, sortOrder: maxSortOrder + 1 }],
          updatedAt: new Date().toISOString()
        }
      }
      return o
    })
    
    await this.saveObjectives(updatedObjectives)
    return newKR
  },

  async updateKeyResult(objectiveId: string, krId: string, updates: Partial<KeyResult>): Promise<void> {
    const objectives = await this.getObjectives()
    const updatedObjectives = objectives.map(o => {
      if (o.id === objectiveId) {
        return {
          ...o,
          keyResults: o.keyResults.map(kr =>
            kr.id === krId ? { ...kr, ...updates, updatedAt: new Date().toISOString() } : kr
          ),
          updatedAt: new Date().toISOString()
        }
      }
      return o
    })
    await this.saveObjectives(updatedObjectives)
  },

  async deleteKeyResult(objectiveId: string, krId: string): Promise<void> {
    const objectives = await this.getObjectives()
    const updatedObjectives = objectives.map(o => {
      if (o.id === objectiveId) {
        return {
          ...o,
          keyResults: o.keyResults.filter(kr => kr.id !== krId),
          updatedAt: new Date().toISOString()
        }
      }
      return o
    })
    await this.saveObjectives(updatedObjectives)
  },

  async updateKRProgress(objectiveId: string, krId: string, currentValue: number): Promise<void> {
    await this.updateKeyResult(objectiveId, krId, { currentValue })
  },

  async linkKRToTask(objectiveId: string, krId: string, taskId: string): Promise<void> {
    await this.updateKeyResult(objectiveId, krId, { taskId, type: 'task' })
  },

  async unlinkKRFromTask(objectiveId: string, krId: string): Promise<void> {
    await this.updateKeyResult(objectiveId, krId, { taskId: undefined, type: 'numeric' })
  },

  async getOKRNotifications(): Promise<OKRMilestoneNotification[]> {
    try {
      let notifications: OKRMilestoneNotification[] = []
      if (isElectron()) {
        const data = await window.api!.store.get(OKR_NOTIFICATIONS_KEY)
        if (data) notifications = data
      } else {
        const localData = localStorage.getItem(OKR_NOTIFICATIONS_KEY)
        if (localData) notifications = JSON.parse(localData)
      }
      return notifications
    } catch {
      return []
    }
  },

  async saveOKRNotifications(notifications: OKRMilestoneNotification[]): Promise<void> {
    try {
      localStorage.setItem(OKR_NOTIFICATIONS_KEY, JSON.stringify(notifications))
      if (isElectron()) {
        await window.api!.store.set(OKR_NOTIFICATIONS_KEY, notifications)
      }
    } catch {
      // ignore
    }
  },

  async addOKRNotification(notification: Omit<OKRMilestoneNotification, 'id' | 'notifiedAt'>): Promise<OKRMilestoneNotification> {
    const notifications = await this.getOKRNotifications()
    const newNotification: OKRMilestoneNotification = {
      ...notification,
      id: generateId(),
      notifiedAt: new Date().toISOString()
    }
    await this.saveOKRNotifications([...notifications, newNotification])
    
    const objectives = await this.getObjectives()
    const updatedObjectives = objectives.map(o => {
      if (o.id === notification.objectiveId && !o.notifiedMilestones.includes(notification.milestone)) {
        return {
          ...o,
          notifiedMilestones: [...o.notifiedMilestones, notification.milestone],
          updatedAt: new Date().toISOString()
        }
      }
      return o
    })
    await this.saveObjectives(updatedObjectives)
    
    return newNotification
  },

  async syncTaskKRProgress(taskId: string, completed: boolean): Promise<void> {
    const objectives = await this.getObjectives()
    let hasUpdates = false
    
    const updatedObjectives = objectives.map(o => {
      const updatedKRs = o.keyResults.map(kr => {
        if (kr.taskId === taskId && kr.type === 'task') {
          hasUpdates = true
          return {
            ...kr,
            currentValue: completed ? kr.targetValue : 0,
            updatedAt: new Date().toISOString()
          }
        }
        return kr
      })
      
      if (hasUpdates) {
        return { ...o, keyResults: updatedKRs, updatedAt: new Date().toISOString() }
      }
      return o
    })
    
    if (hasUpdates) {
      await this.saveObjectives(updatedObjectives)
    }
  }
}
