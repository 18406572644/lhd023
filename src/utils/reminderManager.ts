import dayjs from 'dayjs'
import type { Task, TaskPriority, ReminderLevelConfig, PendingReminder, ReminderSettings, ReminderAnimationType } from '../types'
import { generateId } from './scheduler'
import { soundManager } from './soundManager'

const REMINDER_LEVELS: Record<TaskPriority, ReminderLevelConfig> = {
  urgent: {
    showModal: true,
    alwaysOnTop: true,
    taskbarFlash: true,
    windowFlash: true,
    playSound: true,
    loopSound: true,
    systemNotification: true,
    fullscreen: true,
    animation: 'flash',
    snoozeEnabled: true
  },
  high: {
    showModal: true,
    alwaysOnTop: false,
    taskbarFlash: true,
    windowFlash: true,
    playSound: true,
    loopSound: false,
    systemNotification: true,
    fullscreen: false,
    animation: 'bounce',
    snoozeEnabled: true
  },
  medium: {
    showModal: true,
    alwaysOnTop: false,
    taskbarFlash: false,
    windowFlash: false,
    playSound: true,
    loopSound: false,
    systemNotification: true,
    fullscreen: false,
    animation: 'slideIn',
    snoozeEnabled: true
  },
  low: {
    showModal: false,
    alwaysOnTop: false,
    taskbarFlash: false,
    windowFlash: false,
    playSound: false,
    loopSound: false,
    systemNotification: true,
    fullscreen: false,
    animation: 'fadeIn',
    snoozeEnabled: true
  }
}

const DEFAULT_SETTINGS: ReminderSettings = {
  persistentReminderInterval: 5,
  maxReminderCount: 10,
  urgentSnoozeMinutes: [1, 3, 5, 10],
  highSnoozeMinutes: [5, 10, 30, 60],
  mediumSnoozeMinutes: [5, 10, 30, 60],
  lowSnoozeMinutes: [10, 30, 60, 120],
  animationDuration: 300,
  soundLoopInterval: 3000
}

const isElectron = () => {
  return typeof window !== 'undefined' && window.api !== undefined
}

class ReminderManager {
  private pendingReminders: Map<string, PendingReminder> = new Map()
  private settings: ReminderSettings = DEFAULT_SETTINGS
  private reminderTimers: Map<string, NodeJS.Timeout> = new Map()
  private soundLoopTimer: NodeJS.Timeout | null = null
  private listeners: Set<(reminders: PendingReminder[]) => void> = new Set()
  private currentFullscreenReminder: PendingReminder | null = null
  private badgeCount: number = 0
  private onBadgeChange: ((count: number) => void) | null = null
  private onFullscreenReminder: ((reminder: PendingReminder | null) => void) | null = null
  private onNormalReminder: ((reminder: PendingReminder) => void) | null = null

  constructor() {
    this.loadSettings()
  }

  private async loadSettings() {
    try {
      const saved = localStorage.getItem('reminder_settings')
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      }
    } catch {
      this.settings = DEFAULT_SETTINGS
    }
  }

  async saveSettings(settings: Partial<ReminderSettings>) {
    this.settings = { ...this.settings, ...settings }
    localStorage.setItem('reminder_settings', JSON.stringify(this.settings))
  }

  getSettings(): ReminderSettings {
    return { ...this.settings }
  }

  getReminderLevelConfig(priority: TaskPriority): ReminderLevelConfig {
    return { ...REMINDER_LEVELS[priority] }
  }

  getAllReminderLevels(): Record<TaskPriority, ReminderLevelConfig> {
    const result = {} as Record<TaskPriority, ReminderLevelConfig>
    for (const key of Object.keys(REMINDER_LEVELS) as TaskPriority[]) {
      result[key] = { ...REMINDER_LEVELS[key] }
    }
    return result
  }

  setBadgeChangeCallback(callback: (count: number) => void) {
    this.onBadgeChange = callback
  }

  setFullscreenReminderCallback(callback: (reminder: PendingReminder | null) => void) {
    this.onFullscreenReminder = callback
  }

  setNormalReminderCallback(callback: (reminder: PendingReminder) => void) {
    this.onNormalReminder = callback
  }

  subscribe(callback: (reminders: PendingReminder[]) => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners() {
    const reminders = this.getPendingReminders()
    this.listeners.forEach(callback => callback(reminders))
  }

  private updateBadgeCount() {
    const unacknowledged = Array.from(this.pendingReminders.values()).filter(r => !r.acknowledged)
    this.badgeCount = unacknowledged.length
    if (this.onBadgeChange) {
      this.onBadgeChange(this.badgeCount)
    }
    if (isElectron()) {
      window.api?.notificationBadge?.setBadge?.(this.badgeCount)
    }
  }

  getPendingReminders(): PendingReminder[] {
    return Array.from(this.pendingReminders.values()).sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
      const aPriority = priorityOrder[a.task.priority]
      const bPriority = priorityOrder[b.task.priority]
      if (aPriority !== bPriority) return aPriority - bPriority
      return dayjs(a.triggeredAt).valueOf() - dayjs(b.triggeredAt).valueOf()
    })
  }

  getBadgeCount(): number {
    return this.badgeCount
  }

  async triggerReminder(task: Task) {
    const existing = Array.from(this.pendingReminders.values()).find(r => r.taskId === task.id && !r.acknowledged)
    if (existing) {
      return
    }

    const reminder: PendingReminder = {
      id: generateId(),
      taskId: task.id,
      task,
      triggeredAt: dayjs().toISOString(),
      acknowledged: false,
      reminderCount: 1,
      nextReminderAt: null,
      snoozeMinutes: undefined
    }

    this.pendingReminders.set(reminder.id, reminder)

    const config = this.getReminderLevelConfig(task.priority)

    if (config.systemNotification) {
      this.sendSystemNotification(task)
    }

    if (config.taskbarFlash) {
      this.flashTaskbar(task.priority)
    }

    if (config.fullscreen) {
      this.currentFullscreenReminder = reminder
      if (this.onFullscreenReminder) {
        this.onFullscreenReminder(reminder)
      }
    }

    if (config.showModal && !config.fullscreen) {
      if (this.onNormalReminder) {
        this.onNormalReminder(reminder)
      }
    }

    if (config.playSound) {
      await this.playReminderSound(task, config.loopSound)
    }

    this.schedulePersistentReminder(reminder)

    this.notifyListeners()
    this.updateBadgeCount()

    return reminder
  }

  private async sendSystemNotification(task: Task) {
    try {
      if (isElectron()) {
        await window.api!.notify('任务提醒', task.title)
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('任务提醒', {
          body: task.title,
          icon: '/bell.png',
          badge: '/bell.png',
          requireInteraction: task.priority === 'urgent'
        })
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      }
    } catch (err) {
      console.error('[ReminderManager] 发送系统通知失败:', err)
    }
  }

  private async flashTaskbar(priority: TaskPriority) {
    if (!isElectron()) return
    try {
      const config = this.getReminderLevelConfig(priority)
      if (config.taskbarFlash) {
        await window.api?.windowFlash?.flashTaskbar?.(priority === 'urgent')
      }
      if (config.alwaysOnTop) {
        await window.api?.windowState?.setAlwaysOnTop?.(true)
      }
    } catch (err) {
      console.error('[ReminderManager] 任务栏闪烁失败:', err)
    }
  }

  private async playReminderSound(task: Task, loop: boolean) {
    if (!task.soundEnabled) return
    try {
      await soundManager.playTaskSound(task)
      if (loop) {
        this.startSoundLoop(task)
      }
    } catch (err) {
      console.error('[ReminderManager] 播放声音失败:', err)
    }
  }

  private startSoundLoop(task: Task) {
    this.stopSoundLoop()
    this.soundLoopTimer = setInterval(async () => {
      try {
        await soundManager.playTaskSound(task)
      } catch (err) {
        console.error('[ReminderManager] 循环播放声音失败:', err)
      }
    }, this.settings.soundLoopInterval)
  }

  private stopSoundLoop() {
    if (this.soundLoopTimer) {
      clearInterval(this.soundLoopTimer)
      this.soundLoopTimer = null
    }
    soundManager.stopSound()
  }

  private schedulePersistentReminder(reminder: PendingReminder) {
    this.clearReminderTimer(reminder.id)

    if (reminder.reminderCount >= this.settings.maxReminderCount) {
      return
    }

    const nextTime = dayjs().add(this.settings.persistentReminderInterval, 'minute')
    reminder.nextReminderAt = nextTime.toISOString()

    const delay = nextTime.valueOf() - dayjs().valueOf()
    const timer = setTimeout(() => {
      this.repeatReminder(reminder.id)
    }, delay)

    this.reminderTimers.set(reminder.id, timer)
  }

  private clearReminderTimer(reminderId: string) {
    const timer = this.reminderTimers.get(reminderId)
    if (timer) {
      clearTimeout(timer)
      this.reminderTimers.delete(reminderId)
    }
  }

  private async repeatReminder(reminderId: string) {
    const reminder = this.pendingReminders.get(reminderId)
    if (!reminder || reminder.acknowledged) return

    reminder.reminderCount += 1
    reminder.triggeredAt = dayjs().toISOString()

    const config = this.getReminderLevelConfig(reminder.task.priority)

    if (config.systemNotification) {
      this.sendSystemNotification(reminder.task)
    }

    if (config.taskbarFlash) {
      this.flashTaskbar(reminder.task.priority)
    }

    if (config.playSound && reminder.reminderCount <= 3) {
      await this.playReminderSound(reminder.task, config.loopSound && reminder.reminderCount <= 2)
    }

    if (config.fullscreen && !this.currentFullscreenReminder) {
      this.currentFullscreenReminder = reminder
      if (this.onFullscreenReminder) {
        this.onFullscreenReminder(reminder)
      }
    } else if (config.showModal && !config.fullscreen && this.onNormalReminder) {
      this.onNormalReminder(reminder)
    }

    this.schedulePersistentReminder(reminder)
    this.notifyListeners()
  }

  acknowledgeReminder(reminderId: string) {
    const reminder = this.pendingReminders.get(reminderId)
    if (!reminder) return

    reminder.acknowledged = true
    reminder.nextReminderAt = null

    this.clearReminderTimer(reminderId)

    if (this.currentFullscreenReminder?.id === reminderId) {
      this.currentFullscreenReminder = null
      if (this.onFullscreenReminder) {
        this.onFullscreenReminder(null)
      }
    }

    this.stopSoundLoop()
    this.pendingReminders.delete(reminderId)

    if (isElectron()) {
      window.api?.windowFlash?.stopFlash?.()
      window.api?.windowState?.setAlwaysOnTop?.(false)
    }

    this.notifyListeners()
    this.updateBadgeCount()
  }

  snoozeReminder(reminderId: string, minutes: number) {
    const reminder = this.pendingReminders.get(reminderId)
    if (!reminder) return

    this.clearReminderTimer(reminderId)
    this.stopSoundLoop()

    if (this.currentFullscreenReminder?.id === reminderId) {
      this.currentFullscreenReminder = null
      if (this.onFullscreenReminder) {
        this.onFullscreenReminder(null)
      }
    }

    reminder.snoozeMinutes = minutes
    reminder.nextReminderAt = dayjs().add(minutes, 'minute').toISOString()
    reminder.reminderCount += 1

    if (isElectron()) {
      window.api?.windowFlash?.stopFlash?.()
      window.api?.windowState?.setAlwaysOnTop?.(false)
    }

    const delay = minutes * 60 * 1000
    const timer = setTimeout(() => {
      this.repeatReminder(reminderId)
    }, delay)

    this.reminderTimers.set(reminderId, timer)
    this.notifyListeners()
  }

  getSnoozeOptions(priority: TaskPriority): number[] {
    switch (priority) {
      case 'urgent':
        return [...this.settings.urgentSnoozeMinutes]
      case 'high':
        return [...this.settings.highSnoozeMinutes]
      case 'medium':
        return [...this.settings.mediumSnoozeMinutes]
      case 'low':
        return [...this.settings.lowSnoozeMinutes]
      default:
        return [...this.settings.mediumSnoozeMinutes]
    }
  }

  getAnimationClass(animation: ReminderAnimationType): string {
    const animationClasses: Record<ReminderAnimationType, string> = {
      slideIn: 'reminder-animation-slide-in',
      bounce: 'reminder-animation-bounce',
      flash: 'reminder-animation-flash',
      fadeIn: 'reminder-animation-fade-in',
      zoomIn: 'reminder-animation-zoom-in'
    }
    return animationClasses[animation] || animationClasses.slideIn
  }

  getPriorityColor(priority: TaskPriority): string {
    const colors: Record<TaskPriority, string> = {
      urgent: '#ff4d4f',
      high: '#fa8c16',
      medium: '#1677ff',
      low: '#52c41a'
    }
    return colors[priority]
  }

  getPriorityLabel(priority: TaskPriority): string {
    const labels: Record<TaskPriority, string> = {
      urgent: '紧急',
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级'
    }
    return labels[priority]
  }

  clearAllReminders() {
    this.reminderTimers.forEach(timer => clearTimeout(timer))
    this.reminderTimers.clear()
    this.pendingReminders.clear()
    this.stopSoundLoop()
    this.currentFullscreenReminder = null

    if (this.onFullscreenReminder) {
      this.onFullscreenReminder(null)
    }

    if (isElectron()) {
      window.api?.windowFlash?.stopFlash?.()
      window.api?.windowState?.setAlwaysOnTop?.(false)
    }

    this.notifyListeners()
    this.updateBadgeCount()
  }

  destroy() {
    this.clearAllReminders()
    this.listeners.clear()
    this.onBadgeChange = null
    this.onFullscreenReminder = null
    this.onNormalReminder = null
  }
}

export const reminderManager = new ReminderManager()
