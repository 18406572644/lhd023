export type TaskRepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'

export type SoundType = 'gentle' | 'cheerful' | 'urgent' | 'classic' | 'chime' | 'custom'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskTag = 'work' | 'personal' | 'family' | 'health' | 'study' | 'other'

export type ReminderAnimationType = 'slideIn' | 'bounce' | 'flash' | 'fadeIn' | 'zoomIn'

export type ReminderWindowMode = 'normal' | 'fullscreen' | 'alwaysOnTop'

export interface ReminderLevelConfig {
  showModal: boolean
  alwaysOnTop: boolean
  taskbarFlash: boolean
  windowFlash: boolean
  playSound: boolean
  loopSound: boolean
  systemNotification: boolean
  fullscreen: boolean
  animation: ReminderAnimationType
  snoozeEnabled: boolean
}

export interface PendingReminder {
  id: string
  taskId: string
  task: Task
  triggeredAt: string
  acknowledged: boolean
  reminderCount: number
  nextReminderAt: string | null
  snoozeMinutes?: number
}

export interface ReminderSettings {
  persistentReminderInterval: number
  maxReminderCount: number
  urgentSnoozeMinutes: number[]
  highSnoozeMinutes: number[]
  mediumSnoozeMinutes: number[]
  lowSnoozeMinutes: number[]
  animationDuration: number
  soundLoopInterval: number
}

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
  calendarSync?: TaskCalendarSyncInfo
  isMeeting?: boolean
  meetingPrepReminded?: boolean
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

export interface VocabMapping {
  id: string
  word: string
  category: 'priority' | 'tag' | 'time' | 'title'
  targetValue: string
  createdAt: string
  usageCount: number
}

export interface NLPLearningData {
  vocabMappings: VocabMapping[]
  wordFrequency: Record<string, number>
  successfulParses: number
  totalParses: number
}

export interface ParsedTaskField<T> {
  value: T | null
  isAmbiguous: boolean
  rawText?: string
  confidence: number
}

export interface NLPParseResult {
  title: ParsedTaskField<string>
  targetTime: ParsedTaskField<string>
  repeatType: ParsedTaskField<TaskRepeatType>
  repeatDays?: ParsedTaskField<number[]>
  repeatInterval?: ParsedTaskField<number>
  priority: ParsedTaskField<TaskPriority>
  tag: ParsedTaskField<TaskTag>
  soundEnabled: ParsedTaskField<boolean>
  duration: ParsedTaskField<number>
  rawInput: string
  missingFields: string[]
}

export interface CalendarAccount {
  id: string
  name: string
  type: 'outlook' | 'google' | 'icloud' | 'exchange' | 'local'
  email?: string
  connected: boolean
  connectedAt?: string
  color?: string
}

export interface Calendar {
  id: string
  accountId: string
  name: string
  color: string
  isDefault: boolean
  canWrite: boolean
}

export type CalendarEventStatus = 'free' | 'tentative' | 'busy' | 'outOfOffice'

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  location?: string
  startTime: string
  endTime: string
  isAllDay: boolean
  status: CalendarEventStatus
  isRecurring: boolean
  seriesMasterId?: string
  organizer?: string
  attendees?: string[]
  onlineMeetingUrl?: string
  meetingProvider?: 'zoom' | 'teams' | 'meet' | 'webex' | 'other'
  source: 'system' | 'local'
  lastSyncedAt?: string
  etag?: string
}

export interface CalendarSyncConfig {
  enabled: boolean
  autoSync: boolean
  syncInterval: number
  syncAllDayEvents: boolean
  syncPastDays: number
  syncFutureDays: number
  defaultCalendarId?: string
  calendarsToSync: string[]
  defaultReminderMinutes: number
  conflictDetectionEnabled: boolean
  autoSuggestFreeTime: boolean
  meetingReminderEnabled: boolean
  meetingPrepMinutes: number
}

export interface CalendarConflict {
  taskId: string
  taskTitle: string
  eventId: string
  eventTitle: string
  overlappingStart: string
  overlappingEnd: string
  severity: 'warning' | 'conflict'
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
}

export interface TaskCalendarSyncInfo {
  calendarEventId?: string
  calendarId?: string
  syncedAt?: string
  autoSyncToCalendar: boolean
  syncDirty?: boolean
}

export interface AppSettings {
  defaultSoundId: string
  sounds: SoundOption[]
  hotkeys: HotkeyConfig[]
  widget: WidgetConfig
  calendar: CalendarSyncConfig
}
