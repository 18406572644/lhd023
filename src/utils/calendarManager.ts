import dayjs from 'dayjs'
import type { Task, CalendarEvent, CalendarSyncConfig, CalendarConflict, CalendarAccount, Calendar, TaskCalendarSyncInfo } from '../types'
import { storage } from './storage'
import { generateId, getNextTriggerTime } from './scheduler'

interface CalendarManagerState {
  syncConfig: CalendarSyncConfig | null
  accounts: CalendarAccount[]
  calendars: Calendar[]
  events: CalendarEvent[]
  lastSyncAt: string | null
  syncIntervalId: number | null
  isSyncing: boolean
}

type SyncCallback = (events: CalendarEvent[]) => void
type ConflictCallback = (conflicts: CalendarConflict[]) => void

class CalendarManager {
  private state: CalendarManagerState = {
    syncConfig: null,
    accounts: [],
    calendars: [],
    events: [],
    lastSyncAt: null,
    syncIntervalId: null,
    isSyncing: false
  }

  private syncCallbacks: SyncCallback[] = []
  private conflictCallbacks: ConflictCallback[] = []
  private eventCache: Map<string, CalendarEvent> = new Map()

  constructor() {
    this.init()
  }

  async init() {
    try {
      const [config, accounts, calendars] = await Promise.all([
        storage.getCalendarSyncConfig(),
        storage.getCalendarAccounts(),
        storage.getCalendars()
      ])

      this.state.syncConfig = config
      this.state.accounts = accounts
      this.state.calendars = calendars

      if (config.enabled) {
        await this.loadEvents()
        if (config.autoSync) {
          this.startAutoSync()
        }
      }
    } catch (err) {
      console.error('[CalendarManager] 初始化失败:', err)
    }
  }

  async loadEvents(): Promise<CalendarEvent[]> {
    const config = this.state.syncConfig
    if (!config) return []

    const now = dayjs()
    const startTime = now.subtract(config.syncPastDays, 'day').toISOString()
    const endTime = now.add(config.syncFutureDays, 'day').toISOString()

    const events = await storage.getCalendarEvents(startTime, endTime)
    this.state.events = events
    this.updateEventCache(events)
    this.notifySyncCallbacks(events)
    return events
  }

  private updateEventCache(events: CalendarEvent[]) {
    this.eventCache.clear()
    events.forEach(event => {
      this.eventCache.set(event.id, event)
    })
  }

  private notifySyncCallbacks(events: CalendarEvent[]) {
    this.syncCallbacks.forEach(callback => callback(events))
  }

  private notifyConflictCallbacks(conflicts: CalendarConflict[]) {
    this.conflictCallbacks.forEach(callback => callback(conflicts))
  }

  onSync(callback: SyncCallback): () => void {
    this.syncCallbacks.push(callback)
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback)
    }
  }

  onConflict(callback: ConflictCallback): () => void {
    this.conflictCallbacks.push(callback)
    return () => {
      this.conflictCallbacks = this.conflictCallbacks.filter(cb => cb !== callback)
    }
  }

  async sync(): Promise<{ success: boolean; message: string; eventsCount?: number }> {
    if (this.state.isSyncing) {
      return { success: false, message: '正在同步中...' }
    }

    this.state.isSyncing = true
    try {
      const result = await storage.syncCalendar()
      if (result.success) {
        const events = await this.loadEvents()
        this.state.lastSyncAt = new Date().toISOString()
        return { success: true, message: result.message, eventsCount: events.length }
      }
      return result
    } finally {
      this.state.isSyncing = false
    }
  }

  startAutoSync() {
    this.stopAutoSync()
    const config = this.state.syncConfig
    if (!config?.enabled || !config?.autoSync) return

    const intervalMs = (config.syncInterval || 30) * 60 * 1000
    this.state.syncIntervalId = window.setInterval(() => {
      this.sync()
    }, intervalMs)

    console.log('[CalendarManager] 自动同步已启动，间隔:', config.syncInterval, '分钟')
  }

  stopAutoSync() {
    if (this.state.syncIntervalId) {
      clearInterval(this.state.syncIntervalId)
      this.state.syncIntervalId = null
      console.log('[CalendarManager] 自动同步已停止')
    }
  }

  async updateSyncConfig(config: CalendarSyncConfig): Promise<boolean> {
    const success = await storage.saveCalendarSyncConfig(config)
    if (success) {
      this.state.syncConfig = config

      if (config.enabled && config.autoSync) {
        this.startAutoSync()
        this.loadEvents()
      } else {
        this.stopAutoSync()
      }
    }
    return success
  }

  getSyncConfig(): CalendarSyncConfig | null {
    return this.state.syncConfig
  }

  getEvents(): CalendarEvent[] {
    return this.state.events
  }

  getAccounts(): CalendarAccount[] {
    return this.state.accounts
  }

  getCalendars(): Calendar[] {
    return this.state.calendars
  }

  getLastSyncAt(): string | null {
    return this.state.lastSyncAt
  }

  getEventById(eventId: string): CalendarEvent | undefined {
    return this.eventCache.get(eventId)
  }

  getEventsForDate(date: string | Date | dayjs.Dayjs): CalendarEvent[] {
    const targetDate = dayjs(date).startOf('day')
    const nextDay = targetDate.add(1, 'day')

    return this.state.events.filter(event => {
      const eventStart = dayjs(event.startTime)
      const eventEnd = dayjs(event.endTime)
      return eventStart.isBefore(nextDay) && eventEnd.isAfter(targetDate)
    })
  }

  getBusySlots(startTime: string, endTime: string): CalendarEvent[] {
    const start = dayjs(startTime)
    const end = dayjs(endTime)

    return this.state.events.filter(event => {
      const eventStart = dayjs(event.startTime)
      const eventEnd = dayjs(event.endTime)
      const isBusy = event.status === 'busy' || event.status === 'outOfOffice'
      const overlaps = eventStart.isBefore(end) && eventEnd.isAfter(start)
      return isBusy && overlaps
    })
  }

  async checkConflicts(task: Task): Promise<CalendarConflict[]> {
    const config = this.state.syncConfig
    if (!config?.conflictDetectionEnabled) return []

    const taskStart = getNextTriggerTime(task) || dayjs(task.targetTime)
    const duration = task.duration || 30
    const taskEnd = taskStart.add(duration, 'minute')

    const conflicts = await storage.checkCalendarConflicts(
      taskStart.toISOString(),
      taskEnd.toISOString(),
      task.id
    )

    if (conflicts.length > 0) {
      this.notifyConflictCallbacks(conflicts)
    }

    return conflicts
  }

  async suggestFreeTime(preferredDate: string, durationMinutes: number = 60): Promise<Array<{ start: string; end: string; score: number }>> {
    const slots = await storage.suggestFreeTime(preferredDate, durationMinutes)
    return slots.map((slot, index) => ({
      ...slot,
      score: Math.max(50, 100 - index * 10)
    }))
  }

  convertCalendarEventToTask(event: CalendarEvent, syncConfig?: CalendarSyncConfig): Omit<Task, 'id' | 'createdAt'> {
    const duration = dayjs(event.endTime).diff(dayjs(event.startTime), 'minute')
    
    const isMeeting = this.detectMeeting(event)
    const meetingUrlInfo = event.onlineMeetingUrl || this.findMeetingUrlInText(event.description || '')

    return {
      title: event.title,
      description: event.description || '',
      notes: event.location ? `地点: ${event.location}` : '',
      targetTime: event.startTime,
      repeatType: event.isRecurring ? 'daily' : 'none',
      enabled: true,
      soundEnabled: true,
      priority: event.status === 'outOfOffice' ? 'high' : event.status === 'busy' ? 'medium' : 'low',
      tag: this.guessTaskTag(event),
      duration: duration > 0 ? duration : 30,
      links: meetingUrlInfo ? [{
        id: generateId(),
        title: `加入${this.getMeetingProviderName(event.meetingProvider || 'other')}会议`,
        url: typeof meetingUrlInfo === 'string' ? meetingUrlInfo : meetingUrlInfo.url,
        createdAt: new Date().toISOString()
      }] : [],
      attachments: [],
      isPinned: false,
      calendarSync: {
        calendarEventId: event.id,
        calendarId: event.calendarId,
        syncedAt: new Date().toISOString(),
        autoSyncToCalendar: syncConfig?.autoSync ?? false
      },
      isMeeting,
      meetingPrepReminded: false
    }
  }

  private detectMeeting(event: CalendarEvent): boolean {
    const meetingKeywords = ['会议', 'meeting', '讨论', '评审', '周会', '站会', 'standup', 'review', 'sync']
    const title = event.title.toLowerCase()
    const desc = (event.description || '').toLowerCase()
    
    return meetingKeywords.some(keyword => 
      title.includes(keyword.toLowerCase()) || desc.includes(keyword.toLowerCase())
    ) || !!event.onlineMeetingUrl || !!event.attendees
  }

  private findMeetingUrlInText(text: string): { url: string; provider: string } | null {
    const urlRegex = /https?:\/\/[^\s]+/g
    const urls = text.match(urlRegex) || []
    for (const url of urls) {
      const lowerUrl = url.toLowerCase()
      if (lowerUrl.includes('zoom.us') || lowerUrl.includes('zoom.com')) return { url, provider: 'zoom' }
      if (lowerUrl.includes('teams.microsoft.com')) return { url, provider: 'teams' }
      if (lowerUrl.includes('meet.google.com')) return { url, provider: 'meet' }
      if (lowerUrl.includes('webex.com')) return { url, provider: 'webex' }
    }
    return null
  }

  private getMeetingProviderName(provider: string): string {
    const names: Record<string, string> = {
      zoom: 'Zoom',
      teams: 'Teams',
      meet: 'Google Meet',
      webex: 'Webex',
      other: '视频'
    }
    return names[provider] || '视频'
  }

  private guessTaskTag(event: CalendarEvent): Task['tag'] {
    const title = event.title.toLowerCase()
    const desc = (event.description || '').toLowerCase()

    if (title.includes('会议') || title.includes('meeting') || desc.includes('会议')) return 'work'
    if (title.includes('学习') || title.includes('study') || title.includes('课程')) return 'study'
    if (title.includes('运动') || title.includes('健身') || title.includes('锻炼') || title.includes('健康')) return 'health'
    if (title.includes('家庭') || title.includes('家人') || title.includes('生日') || title.includes('聚会')) return 'family'
    if (title.includes('个人') || title.includes('私人')) return 'personal'
    
    return 'work'
  }

  async syncCalendarEventsToTasks(tasks: Task[]): Promise<{ created: number; updated: number; skipped: number }> {
    const config = this.state.syncConfig
    if (!config?.enabled) return { created: 0, updated: 0, skipped: 0 }

    const existingTasks = tasks
    const syncedEventIds = new Set(
      existingTasks
        .filter(t => t.calendarSync?.calendarEventId)
        .map(t => t.calendarSync!.calendarEventId!)
    )

    let created = 0
    let updated = 0
    let skipped = 0

    const eventsToSync = this.state.events.filter(event => 
      config.calendarsToSync.length === 0 || config.calendarsToSync.includes(event.calendarId)
    )

    for (const event of eventsToSync) {
      if (event.isAllDay && !config.syncAllDayEvents) {
        skipped++
        continue
      }

      const existingTask = existingTasks.find(t => t.calendarSync?.calendarEventId === event.id)
      
      if (existingTask) {
        const eventTime = dayjs(event.startTime)
        const taskTime = dayjs(existingTask.targetTime)
        
        if (!eventTime.isSame(taskTime) || existingTask.title !== event.title) {
          const taskData = this.convertCalendarEventToTask(event, config)
          const updatedTasks = existingTasks.map(t => 
            t.id === existingTask.id ? { ...t, ...taskData } : t
          )
          await storage.saveTasks(updatedTasks)
          updated++
        } else {
          skipped++
        }
      } else {
        if (syncedEventIds.has(event.id)) {
          skipped++
          continue
        }

        const taskData = this.convertCalendarEventToTask(event, config)
        const newTask: Task = {
          id: generateId(),
          createdAt: new Date().toISOString(),
          ...taskData
        }
        await storage.saveTasks([...existingTasks, newTask])
        created++
      }
    }

    return { created, updated, skipped }
  }

  async syncTaskToCalendar(task: Task): Promise<{ success: boolean; eventId?: string; message?: string }> {
    const config = this.state.syncConfig
    if (!config?.enabled) {
      return { success: false, message: '日历同步未启用' }
    }

    const result = await storage.syncTaskToCalendar(task)
    
    if (result.success && result.eventId) {
      const updatedTask: Task = {
        ...task,
        calendarSync: {
          calendarEventId: result.eventId,
          calendarId: task.calendarSync?.calendarId || config.defaultCalendarId,
          syncedAt: new Date().toISOString(),
          autoSyncToCalendar: task.calendarSync?.autoSyncToCalendar ?? true,
          syncDirty: false
        }
      }

      const tasks = await storage.getTasks()
      const updatedTasks = tasks.map(t => t.id === task.id ? updatedTask : t)
      await storage.saveTasks(updatedTasks)
      
      const newEvent: CalendarEvent = {
        id: result.eventId,
        calendarId: task.calendarSync?.calendarId || config.defaultCalendarId || '',
        title: task.title,
        description: task.description || task.notes || '',
        startTime: task.targetTime,
        endTime: new Date(new Date(task.targetTime).getTime() + (task.duration || 30) * 60000).toISOString(),
        isAllDay: false,
        status: 'busy',
        isRecurring: false,
        source: 'local',
        lastSyncedAt: new Date().toISOString()
      }
      this.state.events.push(newEvent)
      this.updateEventCache(this.state.events)
    }

    return result
  }

  async updateTaskCalendarSync(taskId: string, syncInfo: Partial<TaskCalendarSyncInfo>): Promise<void> {
    const tasks = await storage.getTasks()
    const updatedTasks = tasks.map(t => 
      t.id === taskId 
        ? { 
            ...t, 
            calendarSync: { 
              autoSyncToCalendar: t.calendarSync?.autoSyncToCalendar ?? false,
              ...t.calendarSync, 
              ...syncInfo 
            } 
          }
        : t
    )
    await storage.saveTasks(updatedTasks)
  }

  async deleteTaskCalendarEvent(task: Task): Promise<boolean> {
    if (!task.calendarSync?.calendarEventId) return false
    
    const result = await storage.deleteCalendarEvent(task.calendarSync.calendarEventId)
    
    if (result.success) {
      this.state.events = this.state.events.filter(e => e.id !== task.calendarSync?.calendarEventId)
      this.updateEventCache(this.state.events)
      await this.updateTaskCalendarSync(task.id, { calendarEventId: undefined, syncedAt: undefined })
    }
    
    return result.success
  }

  async openMeeting(url: string): Promise<boolean> {
    return await storage.openMeetingUrl(url)
  }

  getMeetingProviderIcon(provider?: string): string {
    const icons: Record<string, string> = {
      zoom: '🎥',
      teams: '👥',
      meet: '📹',
      webex: '📺',
      other: '🔗'
    }
    return icons[provider || 'other'] || '🔗'
  }

  destroy() {
    this.stopAutoSync()
    this.syncCallbacks = []
    this.conflictCallbacks = []
    this.eventCache.clear()
  }
}

export const calendarManager = new CalendarManager()
