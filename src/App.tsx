import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Layout, Typography, Button, Tabs, Badge, ConfigProvider, message, Space, Tooltip, Dropdown, notification } from 'antd'
import { PlusOutlined, HistoryOutlined, BellOutlined, LogoutOutlined, SettingOutlined, CalendarOutlined, ThunderboltOutlined, FileTextOutlined, AppstoreOutlined, AppstoreAddOutlined, BarChartOutlined, DownOutlined, RobotOutlined, BookOutlined, VideoCameraOutlined, TrophyOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { Task, TaskHistory, HotkeyConfig, PendingReminder, Objective, KeyResult } from './types'
import { storage } from './utils/storage'
import { shouldTriggerTask, generateId, getNextTriggerTime } from './utils/scheduler'
import { soundManager } from './utils/soundManager'
import { reminderManager } from './utils/reminderManager'
import { calendarManager } from './utils/calendarManager'
import { updateAllObjectivesStatus, syncTaskKRsWithTasks } from './utils/okrManager'
import { TaskForm } from './components/TaskForm'
import { QuickTaskForm } from './components/QuickTaskForm'
import { NaturalLanguageTaskForm } from './components/NaturalLanguageTaskForm'
import { VocabManager } from './components/VocabManager'
import { TaskList } from './components/TaskList'
import { CalendarView } from './components/CalendarView'
import { HistoryPanel } from './components/HistoryPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { NotificationModal } from './components/NotificationModal'
import { FullscreenReminder } from './components/FullscreenReminder'
import { TemplateManager } from './components/TemplateManager'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { StatsPanel } from './components/StatsPanel'
import { OKRBoard } from './components/OKRBoard'
import { OKRForm } from './components/OKRForm'
import { OKRDetailPanel } from './components/OKRDetailPanel'

const { Header, Content } = Layout
const { Title, Text } = Typography

const DEBUG = true

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[TaskReminder]', ...args)
  }
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [history, setHistory] = useState<TaskHistory[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [quickFormOpen, setQuickFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [currentReminder, setCurrentReminder] = useState<PendingReminder | null>(null)
  const [fullscreenReminder, setFullscreenReminder] = useState<PendingReminder | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [activeTab, setActiveTab] = useState('tasks')
  const [defaultTaskTime, setDefaultTaskTime] = useState<Dayjs | null>(null)
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>([])
  const [templateTaskData, setTemplateTaskData] = useState<Omit<Task, 'id' | 'createdAt'> | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [widgetEnabled, setWidgetEnabled] = useState(false)
  const [nlpFormOpen, setNlpFormOpen] = useState(false)
  const [vocabManagerOpen, setVocabManagerOpen] = useState(false)
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [okrFormOpen, setOkrFormOpen] = useState(false)
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null)
  const [okrDetailOpen, setOkrDetailOpen] = useState(false)
  const [viewingObjective, setViewingObjective] = useState<Objective | null>(null)
  const triggeredTasksRef = useRef<Set<string>>(new Set())
  const intervalRef = useRef<number | null>(null)
  const tasksRef = useRef<Task[]>([])
  const historyRef = useRef<TaskHistory[]>([])
  const objectivesRef = useRef<Objective[]>([])
  const okrCheckIntervalRef = useRef<number | null>(null)
  const hotkeyUnsubscribeRef = useRef<(() => void) | null>(null)
  const calendarSyncIntervalRef = useRef<number | null>(null)
  const meetingPrepRemindedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    objectivesRef.current = objectives
  }, [objectives])

  const loadData = useCallback(async () => {
    log('加载数据...')
    const [loadedTasks, loadedHistory, loadedObjectives] = await Promise.all([
      storage.getTasks(),
      storage.getHistory(),
      storage.getObjectives()
    ])
    setTasks(loadedTasks)
    setHistory(loadedHistory)
    setObjectives(loadedObjectives)
    log('加载完成，任务数:', loadedTasks.length, '历史记录数:', loadedHistory.length, '目标数:', loadedObjectives.length)
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    const permission = await storage.requestNotificationPermission()
    if (permission === 'granted') {
      message.success('通知权限已开启')
    } else if (permission === 'denied') {
      message.warning('通知权限被拒绝，将仅显示弹窗提醒')
    }
  }, [])

  const initHotkeys = useCallback(async () => {
    log('初始化全局热键...')
    try {
      const loadedHotkeys = await storage.getHotkeys()
      setHotkeys(loadedHotkeys)
      log('加载热键配置:', loadedHotkeys)

      for (const hotkey of loadedHotkeys) {
        if (hotkey.enabled) {
          const success = await storage.registerHotkey(hotkey.accelerator, hotkey.id)
          log(`注册热键 ${hotkey.accelerator}: ${success ? '成功' : '失败'}`)
        }
      }

      if (window.api?.hotkeys?.onTrigger) {
        hotkeyUnsubscribeRef.current = window.api.hotkeys.onTrigger((hotkeyId: string) => {
          log(`热键触发: ${hotkeyId}`)
          if (hotkeyId === 'quick-create-task') {
            setQuickFormOpen(true)
          }
        })
      }
    } catch (err) {
      console.error('初始化热键失败:', err)
    }
  }, [])

  const initWidget = useCallback(async () => {
    log('初始化小组件...')
    try {
      const widgetConfig = await storage.getWidgetConfig()
      setWidgetEnabled(widgetConfig.enabled)
      log('加载小组件配置:', widgetConfig)

      if (window.api?.widget?.onTaskUpdateRequested) {
        window.api.widget.onTaskUpdateRequested(() => {
          log('收到小组件任务更新请求')
          loadData()
        })
      }
    } catch (err) {
      console.error('初始化小组件失败:', err)
    }
  }, [])

  const initReminderManager = useCallback(() => {
    log('初始化提醒管理器...')

    reminderManager.setBadgeChangeCallback((count) => {
      setBadgeCount(count)
    })

    reminderManager.setFullscreenReminderCallback((reminder) => {
      log('全屏提醒回调:', reminder?.task.title)
      setFullscreenReminder(reminder)
    })

    reminderManager.setNormalReminderCallback((reminder) => {
      log('普通提醒回调:', reminder.task.title)
      setCurrentReminder(reminder)
      setNotificationOpen(true)
    })

    log('提醒管理器初始化完成')
  }, [])

  const initCalendarManager = useCallback(async () => {
    log('初始化日历管理器...')
    
    try {
      await calendarManager.init()
      
      const syncConfig = await storage.getCalendarSyncConfig()
      
      if (syncConfig.enabled) {
        const initialResult = await calendarManager.sync()
        log('初始日历同步完成，事件数:', initialResult.eventsCount)
        
        const currentTasks = tasksRef.current
        const syncStats = await calendarManager.syncCalendarEventsToTasks(currentTasks)
        if (syncStats.created > 0) {
          const updatedTasks = await storage.getTasks()
          await saveTasks(updatedTasks)
          message.success(`已从日历同步 ${syncStats.created} 个任务，更新 ${syncStats.updated} 个`)
        }

        if (syncConfig.autoSync) {
          calendarManager.startAutoSync()
        }
      }

      calendarManager.onSync(async (events) => {
        log('日历自动同步完成，事件数:', events.length)
        if (events.length > 0) {
          const currentTasks = tasksRef.current
          const syncStats = await calendarManager.syncCalendarEventsToTasks(currentTasks)
          if (syncStats.created > 0 || syncStats.updated > 0) {
            const updatedTasks = await storage.getTasks()
            await saveTasks(updatedTasks)
          }
        }
      })

      log('日历管理器初始化完成')
    } catch (err) {
      console.error('初始化日历管理器失败:', err)
    }
  }, [])

  const checkMeetingPrepReminders = useCallback(async () => {
    const now = dayjs()
    const currentTasks = tasksRef.current

    for (const task of currentTasks) {
      if (!task.enabled || !task.isMeeting || task.meetingPrepReminded) continue

      const taskTime = dayjs(task.targetTime)
      const minutesUntilMeeting = taskTime.diff(now, 'minute')

      const prepTime = 15
      if (minutesUntilMeeting > 0 && minutesUntilMeeting <= prepTime) {
        const remindedKey = `${task.id}-${task.targetTime}`
        if (!meetingPrepRemindedRef.current.has(remindedKey)) {
          meetingPrepRemindedRef.current.add(remindedKey)
          
          const meetingInfo = await storage.findMeetingUrl(
            task.notes + ' ' + (task.description || '') + ' ' + JSON.stringify(task.links || [])
          )

          notification.info({
            message: '会议准备提醒',
            description: (
              <div>
                <p><strong>{task.title}</strong> 将在 {minutesUntilMeeting} 分钟后开始</p>
                {meetingInfo && (
                  <Button
                    type="primary"
                    icon={<VideoCameraOutlined />}
                    onClick={() => {
                      calendarManager.openMeeting(meetingInfo.url)
                      notification.destroy()
                    }}
                    style={{ marginTop: 8 }}
                  >
                    立即加入会议
                  </Button>
                )}
              </div>
            ),
            duration: 0,
            placement: 'topRight',
            icon: <VideoCameraOutlined style={{ color: '#1677ff' }} />
          })

          const updatedTasks = currentTasks.map(t =>
            t.id === task.id ? { ...t, meetingPrepReminded: true } : t
          )
          saveTasks(updatedTasks)

          log('会议准备提醒已发送:', task.title, minutesUntilMeeting, '分钟后开始')
        }
      }
    }
  }, [])

  const initOKRManager = useCallback(async () => {
    log('初始化OKR管理器...')
    try {
      await updateAllObjectivesStatus()
      log('OKR管理器初始化完成')
    } catch (err) {
      console.error('初始化OKR管理器失败:', err)
    }
  }, [])

  useEffect(() => {
    loadData()
    requestNotificationPermission()
    initHotkeys()
    initWidget()
    initReminderManager()
    initCalendarManager()
    initOKRManager()

    const calendarCheckInterval = window.setInterval(() => {
      checkMeetingPrepReminders()
    }, 60000)

    const okrCheckInterval = window.setInterval(async () => {
      log('检查OKR进度和里程碑...')
      await updateAllObjectivesStatus()
      const updatedObjectives = await storage.getObjectives()
      setObjectives(updatedObjectives)
      
      const currentTasks = tasksRef.current
      await syncTaskKRsWithTasks(currentTasks)
    }, 300000)
    okrCheckIntervalRef.current = okrCheckInterval

    return () => {
      if (hotkeyUnsubscribeRef.current) {
        hotkeyUnsubscribeRef.current()
      }
      if (calendarSyncIntervalRef.current) {
        clearInterval(calendarSyncIntervalRef.current)
      }
      if (okrCheckIntervalRef.current) {
        clearInterval(okrCheckIntervalRef.current)
      }
      clearInterval(calendarCheckInterval)
      calendarManager.stopAutoSync()
      reminderManager.destroy()
    }
  }, [loadData, requestNotificationPermission, initHotkeys, initWidget, initReminderManager, initCalendarManager, initOKRManager, checkMeetingPrepReminders])

  const saveTasks = useCallback(async (newTasks: Task[]) => {
    setTasks(newTasks)
    await storage.saveTasks(newTasks)
    await storage.broadcastTaskUpdate()
    
    await syncTaskKRsWithTasks(newTasks)
    const updatedObjectives = await storage.getObjectives()
    setObjectives(updatedObjectives)
  }, [])

  const handleToggleWidget = useCallback(async () => {
    try {
      const result = await storage.toggleWidget()
      setWidgetEnabled(result)
      message.success(result ? '桌面小组件已开启' : '桌面小组件已关闭')
    } catch (err) {
      console.error('切换小组件失败:', err)
      message.error('操作失败')
    }
  }, [])

  const saveHistory = useCallback(async (newHistory: TaskHistory[]) => {
    setHistory(newHistory)
    await storage.saveHistory(newHistory)
  }, [])

  const addHistoryRecord = useCallback(async (task: Task, status: TaskHistory['status'] = 'completed') => {
    const record: TaskHistory = {
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      triggeredAt: dayjs().toISOString(),
      status
    }
    const newHistory = [record, ...historyRef.current].slice(0, 500)
    await saveHistory(newHistory)
    log('添加历史记录:', task.title, status)
  }, [saveHistory])

  const triggerTestNotification = useCallback(async (priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium') => {
    log('手动触发测试提醒，优先级:', priority)
    const defaultSoundId = await soundManager.getDefaultSoundId()
    const testTask: Task = {
      id: 'test-' + Date.now(),
      title: `🔔 测试提醒 (${reminderManager.getPriorityLabel(priority)})`,
      description: `这是一条${reminderManager.getPriorityLabel(priority)}测试提醒，用于验证通知功能是否正常工作！`,
      targetTime: dayjs().toISOString(),
      repeatType: 'none',
      enabled: true,
      createdAt: dayjs().toISOString(),
      soundEnabled: true,
      soundId: defaultSoundId,
      priority: priority,
      tag: 'other',
      notes: '',
      links: [],
      attachments: [],
      isPinned: false
    }

    await reminderManager.triggerReminder(testTask)
  }, [])

  const createTestTask = useCallback(async () => {
    const defaultSoundId = await soundManager.getDefaultSoundId()
    const testTask: Task = {
      id: generateId(),
      title: '⏰ 测试任务（1分钟后）',
      description: '这是一个自动创建的测试任务，将在1分钟后触发提醒',
      targetTime: dayjs().add(1, 'minute').toISOString(),
      repeatType: 'none',
      enabled: true,
      createdAt: dayjs().toISOString(),
      soundEnabled: true,
      soundId: defaultSoundId,
      priority: 'high',
      tag: 'work',
      notes: '',
      links: [],
      attachments: [],
      isPinned: false
    }
    saveTasks([...tasks, testTask])
    message.success('测试任务已创建，将在1分钟后触发提醒')
    log('创建测试任务:', testTask.title, '触发时间:', dayjs(testTask.targetTime).format('YYYY-MM-DD HH:mm:ss'))
  }, [tasks, saveTasks])

  const checkTasks = useCallback(() => {
    const now = dayjs()
    const currentTasks = tasksRef.current

    log('检查任务，当前时间:', now.format('YYYY-MM-DD HH:mm:ss'))
    log('待检查任务数:', currentTasks.length)

    currentTasks.forEach((task) => {
      if (!task.enabled) {
        log('跳过已禁用任务:', task.title)
        return
      }

      const shouldTrigger = shouldTriggerTask(task, now)
      const alreadyTriggered = triggeredTasksRef.current.has(task.id)
      const hasPendingReminder = reminderManager.getPendingReminders().some(r => r.taskId === task.id && !r.acknowledged)

      log('检查任务:', task.title, '应触发:', shouldTrigger, '已触发:', alreadyTriggered, '有待处理:', hasPendingReminder, '目标时间:', dayjs(task.targetTime).format('YYYY-MM-DD HH:mm'))

      if (shouldTrigger && !alreadyTriggered && !hasPendingReminder) {
        log('===== 触发任务 =====')
        log('任务名称:', task.title)
        log('任务描述:', task.description)
        log('任务优先级:', task.priority)

        triggeredTasksRef.current.add(task.id)
        reminderManager.triggerReminder(task)

        if (task.repeatType === 'none') {
          const updatedTasks = currentTasks.map((t) =>
            t.id === task.id ? { ...t, enabled: false } : t
          )
          saveTasks(updatedTasks)
          log('单次任务已自动禁用')
        }

        setTimeout(() => {
          triggeredTasksRef.current.delete(task.id)
          log('任务触发锁已释放:', task.title)
        }, 300000)
      }
    })
  }, [saveTasks])

  useEffect(() => {
    log('启动任务调度器，每10秒检查一次')
    checkTasks()

    const runCheck = () => {
      checkTasks()
    }

    intervalRef.current = window.setInterval(runCheck, 10000)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        log('页面变为可见，立即检查任务')
        runCheck()
      }
    }

    const handleOnline = () => {
      log('网络恢复，立即检查任务')
      runCheck()
    }

    const handleFocus = () => {
      log('窗口获得焦点，立即检查任务')
      runCheck()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)

    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').catch((err: any) => {
        log('无法获取屏幕常亮锁:', err)
      })
    }

    return () => {
      log('清理调度器')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
    }
  }, [checkTasks])

  const handleAddTask = (defaultTime?: Dayjs | React.MouseEvent) => {
    setEditingTask(null)
    if (defaultTime && 'isValid' in defaultTime && defaultTime.isValid()) {
      setDefaultTaskTime(defaultTime as Dayjs)
    } else {
      setDefaultTaskTime(null)
    }
    setFormOpen(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setDefaultTaskTime(null)
    setFormOpen(true)
  }

  const handleUpdateTaskTime = useCallback(async (task: Task, newTime: string) => {
    const updatedTasks = tasks.map((t) =>
      t.id === task.id ? { ...t, targetTime: newTime } : t
    )
    await saveTasks(updatedTasks)
    message.success('任务时间已更新')

    if (task.calendarSync?.autoSyncToCalendar && task.calendarSync.calendarEventId) {
      try {
        const updatedTask = { ...task, targetTime: newTime }
        await calendarManager.syncTaskToCalendar(updatedTask)
      } catch (err) {
        console.error('同步任务时间变更到日历失败:', err)
        message.warning('同步到日历失败')
      }
    }
  }, [tasks, saveTasks])

  const handleDeleteTask = async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id)
    
    if (taskToDelete?.calendarSync?.calendarEventId) {
      try {
        await storage.deleteCalendarEvent(taskToDelete.calendarSync.calendarEventId)
        log('已删除关联的日历事件')
      } catch (err) {
        console.error('删除日历事件失败:', err)
        message.warning('删除日历事件失败')
      }
    }

    const newTasks = tasks.filter((t) => t.id !== id)
    await saveTasks(newTasks)
    message.success('任务已删除')
  }

  const handleToggleTask = async (id: string, enabled: boolean) => {
    const newTasks = tasks.map((t) =>
      t.id === id ? { ...t, enabled } : t
    )
    await saveTasks(newTasks)
  }

  const handlePinTask = async (id: string, isPinned: boolean) => {
    const newTasks = tasks.map((t) =>
      t.id === id ? { ...t, isPinned, pinnedAt: isPinned ? dayjs().toISOString() : undefined } : t
    )
    await saveTasks(newTasks)
    message.success(isPinned ? '已置顶' : '已取消置顶')
  }

  const handleFormSubmit = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    if (editingTask) {
      const updatedTask: Task = {
        ...editingTask,
        ...taskData
      }
      const updatedTasks = tasks.map((t) =>
        t.id === editingTask.id ? updatedTask : t
      )
      await saveTasks(updatedTasks)
      message.success('任务已更新')

      if (taskData.calendarSync?.autoSyncToCalendar) {
        try {
          await calendarManager.syncTaskToCalendar(updatedTask)
        } catch (err) {
          console.error('同步到日历失败:', err)
        }
      }
    } else {
      const newTask: Task = {
        id: generateId(),
        createdAt: dayjs().toISOString(),
        ...taskData
      }
      await saveTasks([...tasks, newTask])
      message.success('任务已创建')

      if (taskData.calendarSync?.autoSyncToCalendar && taskData.calendarSync?.calendarId) {
        try {
          await calendarManager.syncTaskToCalendar(newTask)
        } catch (err) {
          console.error('同步到日历失败:', err)
        }
      }
    }
    setFormOpen(false)
    setEditingTask(null)
  }

  const handleQuickFormSubmit = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      id: generateId(),
      createdAt: dayjs().toISOString(),
      ...taskData
    }
    await saveTasks([...tasks, newTask])
    message.success('任务已创建')
    setQuickFormOpen(false)
  }

  const handleNLPFormSubmit = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      id: generateId(),
      createdAt: dayjs().toISOString(),
      ...taskData
    }
    await saveTasks([...tasks, newTask])
    message.success('任务已创建')
    setNlpFormOpen(false)
  }

  const handleQuickAddTask = () => {
    setQuickFormOpen(true)
  }

  const handleNLPAddTask = () => {
    setNlpFormOpen(true)
  }

  const handleVocabManagerOpen = () => {
    setVocabManagerOpen(true)
  }

  const handleSnooze = (minutes: number) => {
    if (currentReminder) {
      reminderManager.snoozeReminder(currentReminder.id, minutes)
      addHistoryRecord(currentReminder.task, 'skipped')
      message.success(`将在 ${minutes} 分钟后再次提醒`)
    }
    setNotificationOpen(false)
    setCurrentReminder(null)
  }

  const handleNotificationClose = () => {
    if (currentReminder) {
      reminderManager.acknowledgeReminder(currentReminder.id)
    }
    setNotificationOpen(false)
    setCurrentReminder(null)
  }

  const handleFullscreenSnooze = (minutes: number) => {
    if (fullscreenReminder) {
      reminderManager.snoozeReminder(fullscreenReminder.id, minutes)
      addHistoryRecord(fullscreenReminder.task, 'skipped')
      message.success(`将在 ${minutes} 分钟后再次提醒`)
    }
    setFullscreenReminder(null)
  }

  const handleFullscreenClose = () => {
    if (fullscreenReminder) {
      reminderManager.acknowledgeReminder(fullscreenReminder.id)
    }
    setFullscreenReminder(null)
  }

  const handleClearHistory = async () => {
    await saveHistory([])
    message.success('历史记录已清空')
  }

  const handleQuit = async () => {
    if (window.api?.quit) {
      await window.api.quit()
    }
  }

  const saveObjectives = useCallback(async (newObjectives: Objective[]) => {
    setObjectives(newObjectives)
    await storage.saveObjectives(newObjectives)
  }, [])

  const handleAddObjective = useCallback(() => {
    setEditingObjective(null)
    setOkrFormOpen(true)
  }, [])

  const handleEditObjective = useCallback((objective: Objective) => {
    setEditingObjective(objective)
    setOkrFormOpen(true)
  }, [])

  const handleOKRFormSubmit = useCallback(async (
    objectiveData: Omit<Objective, 'id' | 'createdAt' | 'updatedAt' | 'keyResults' | 'notifiedMilestones' | 'status'>,
    keyResults: Omit<KeyResult, 'id' | 'objectiveId' | 'createdAt' | 'updatedAt'>[]
  ) => {
    if (editingObjective) {
      const updatedObjective: Objective = {
        ...editingObjective,
        ...objectiveData,
        keyResults: editingObjective.keyResults.map(kr => {
          const updatedKR = keyResults.find(
            k => k.title === kr.title || k.sortOrder === kr.sortOrder
          )
          return updatedKR ? { ...kr, ...updatedKR } : kr
        }),
        updatedAt: new Date().toISOString()
      }

      const newKRs = keyResults.filter(
        kr => !editingObjective.keyResults.some(
          existing => existing.title === kr.title || existing.sortOrder === kr.sortOrder
        )
      )

      for (const newKR of newKRs) {
        await storage.addKeyResult(editingObjective.id, newKR)
      }

      const updatedObjectives = objectives.map(o =>
        o.id === editingObjective.id ? updatedObjective : o
      )
      await saveObjectives(updatedObjectives)
      message.success('目标已更新')

      if (viewingObjective && viewingObjective.id === editingObjective.id) {
        setViewingObjective(updatedObjective)
      }
    } else {
      const newObjective = await storage.addObjective(objectiveData)
      
      for (const kr of keyResults) {
        await storage.addKeyResult(newObjective.id, kr)
      }

      const loadedObjectives = await storage.getObjectives()
      setObjectives(loadedObjectives)
      message.success('目标已创建')
    }
    
    setOkrFormOpen(false)
    setEditingObjective(null)
    await updateAllObjectivesStatus()
    loadData()
  }, [editingObjective, objectives, viewingObjective, saveObjectives, loadData])

  const handleViewObjectiveDetail = useCallback((objective: Objective) => {
    setViewingObjective(objective)
    setOkrDetailOpen(true)
  }, [])

  const handleCloseOKRDetail = useCallback(() => {
    setOkrDetailOpen(false)
    setViewingObjective(null)
  }, [])

  const handleDeleteObjective = useCallback(async (id: string) => {
    await storage.deleteObjective(id)
    const updatedObjectives = await storage.getObjectives()
    setObjectives(updatedObjectives)
    
    if (viewingObjective && viewingObjective.id === id) {
      handleCloseOKRDetail()
    }
  }, [viewingObjective, handleCloseOKRDetail])

  const handleUpdateKRProgress = useCallback(async (objectiveId: string, krId: string, currentValue: number) => {
    await storage.updateKRProgress(objectiveId, krId, currentValue)
    const updatedObjectives = await storage.getObjectives()
    setObjectives(updatedObjectives)
    await updateAllObjectivesStatus()
    
    const updatedObjective = updatedObjectives.find(o => o.id === objectiveId)
    if (updatedObjective && viewingObjective && viewingObjective.id === objectiveId) {
      setViewingObjective(updatedObjective)
    }
  }, [viewingObjective])

  const handleAddKRToObjective = useCallback((objective: Objective) => {
    setEditingObjective(objective)
    setOkrFormOpen(true)
  }, [])

  const handleEditKR = useCallback((objective: Objective) => {
    message.info('请通过编辑目标来修改KR')
    handleEditObjective(objective)
  }, [handleEditObjective])

  const handleDeleteKR = useCallback(async (objectiveId: string, krId: string) => {
    await storage.deleteKeyResult(objectiveId, krId)
    const updatedObjectives = await storage.getObjectives()
    setObjectives(updatedObjectives)
    
    const updatedObjective = updatedObjectives.find(o => o.id === objectiveId)
    if (updatedObjective && viewingObjective && viewingObjective.id === objectiveId) {
      setViewingObjective(updatedObjective)
    }
  }, [viewingObjective])

  const handleCreateTaskFromTemplate = useCallback(async (templateId: string) => {
    try {
      const taskData = await storage.createTaskFromTemplate(templateId)
      if (taskData) {
        setTemplateTaskData(taskData)
        setEditingTask(null)
        setDefaultTaskTime(null)
        setFormOpen(true)
        setActiveTab('tasks')
      }
    } catch (err) {
      console.error('从模板创建任务失败:', err)
      message.error('创建任务失败')
    }
  }, [])

  const handleViewDetail = useCallback((task: Task) => {
    setViewingTask(task)
    setDetailPanelOpen(true)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailPanelOpen(false)
    setViewingTask(null)
  }, [])

  const handleUpdateTaskFromDetail = useCallback(async (updatedTask: Task) => {
    const updatedTasks = tasks.map(t =>
      t.id === updatedTask.id ? updatedTask : t
    )
    await saveTasks(updatedTasks)
    setViewingTask(updatedTask)
  }, [tasks, saveTasks])

  const enabledTasksCount = tasks.filter((t) => t.enabled && getNextTriggerTime(t)).length

  const calendarTasksCount = tasks.filter(t => t.enabled).length

  const inProgressObjectivesCount = objectives.filter(o => o.status === 'in_progress').length

  const tabItems = [
    {
      key: 'tasks',
      label: (
        <Space>
          <BellOutlined />
          任务列表
          {enabledTasksCount > 0 && (
            <Badge count={enabledTasksCount} size="small" />
          )}
        </Space>
      ),
      children: (
        <TaskList
          tasks={[...tasks].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1
            if (!a.isPinned && b.isPinned) return 1
            if (a.isPinned && b.isPinned) {
              const aNext = getNextTriggerTime(a)
              const bNext = getNextTriggerTime(b)
              if (!aNext && !bNext) return 0
              if (!aNext) return 1
              if (!bNext) return -1
              return aNext.valueOf() - bNext.valueOf()
            }
            const aNext = getNextTriggerTime(a)
            const bNext = getNextTriggerTime(b)
            if (!aNext && !bNext) return 0
            if (!aNext) return 1
            if (!bNext) return -1
            return aNext.valueOf() - bNext.valueOf()
          })}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onToggle={handleToggleTask}
          onPin={handlePinTask}
          onViewDetail={handleViewDetail}
        />
      )
    },
    {
      key: 'okrs',
      label: (
        <Space>
          <TrophyOutlined />
          目标管理
          {inProgressObjectivesCount > 0 && (
            <Badge count={inProgressObjectivesCount} size="small" />
          )}
        </Space>
      ),
      children: (
        <OKRBoard
          objectives={objectives}
          tasks={tasks}
          onAddObjective={handleAddObjective}
          onEditObjective={handleEditObjective}
          onViewDetail={handleViewObjectiveDetail}
          onDeleteObjective={handleDeleteObjective}
          onUpdateProgress={handleUpdateKRProgress}
        />
      )
    },
    {
      key: 'calendar',
      label: (
        <Space>
          <CalendarOutlined />
          日历
          {calendarTasksCount > 0 && (
            <Badge count={calendarTasksCount} size="small" />
          )}
        </Space>
      ),
      children: (
        <CalendarView
          tasks={tasks}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onUpdateTaskTime={handleUpdateTaskTime}
        />
      )
    },
    {
      key: 'history',
      label: (
        <Space>
          <HistoryOutlined />
          历史记录
          {history.length > 0 && (
            <Badge count={history.length} size="small" />
          )}
        </Space>
      ),
      children: <HistoryPanel history={history} onClear={handleClearHistory} />
    },
    {
      key: 'stats',
      label: (
        <Space>
          <BarChartOutlined />
          统计
        </Space>
      ),
      children: <StatsPanel tasks={tasks} history={history} />
    },
    {
      key: 'templates',
      label: (
        <Space>
          <FileTextOutlined />
          任务模板
        </Space>
      ),
      children: (
        <TemplateManager
          onCreateTaskFromTemplate={handleCreateTaskFromTemplate}
        />
      )
    },
    {
      key: 'settings',
      label: (
        <Space>
          <SettingOutlined />
          设置
        </Space>
      ),
      children: <SettingsPanel />
    }
  ]

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            headerHeight: 64,
            headerPadding: '0 24px'
          }
        }
      }}
    >
      <Layout style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            padding: '0 24px'
          }}
        >
          <Space>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: '#1677ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <BellOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, fontSize: 16 }}>
                任务提醒
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                高效管理您的时间
              </Text>
            </div>
          </Space>

          <Space>
            <Dropdown
              menu={{
                items: [
                  { key: 'low', label: '低优先级测试', onClick: () => triggerTestNotification('low') },
                  { key: 'medium', label: '中优先级测试', onClick: () => triggerTestNotification('medium') },
                  { key: 'high', label: '高优先级测试', onClick: () => triggerTestNotification('high') },
                  { key: 'urgent', label: '紧急测试（全屏）', onClick: () => triggerTestNotification('urgent') }
                ]
              }}
            >
              <Button size="middle">
                测试提醒 <DownOutlined />
              </Button>
            </Dropdown>
            <Tooltip title={`待处理提醒: ${badgeCount}`}>
              <Badge count={badgeCount} size="small" offset={[-5, 5]}>
                <Button
                  onClick={createTestTask}
                  size="middle"
                >
                  创建测试任务
                </Button>
              </Badge>
            </Tooltip>
            <Tooltip title={widgetEnabled ? '关闭桌面小组件' : '开启桌面小组件'}>
              <Button
                icon={widgetEnabled ? <AppstoreOutlined /> : <AppstoreAddOutlined />}
                onClick={handleToggleWidget}
                size="middle"
                type={widgetEnabled ? 'primary' : 'default'}
              >
                {widgetEnabled ? '小组件' : '小组件'}
              </Button>
            </Tooltip>
            <Tooltip title={`快速创建任务 (${hotkeys.find(h => h.id === 'quick-create-task')?.accelerator || 'Ctrl+Alt+N'})`}>
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleQuickAddTask}
                size="middle"
              >
                快速创建
              </Button>
            </Tooltip>
            <Tooltip title="自然语言创建">
              <Button
                icon={<RobotOutlined />}
                onClick={handleNLPAddTask}
                size="middle"
                type="default"
              >
                智能创建
              </Button>
            </Tooltip>
            <Tooltip title="词汇管理">
              <Button
                icon={<BookOutlined />}
                onClick={handleVocabManagerOpen}
                size="middle"
              >
                词汇
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddTask}
              size="middle"
            >
              新建任务
            </Button>
            <Tooltip title="退出应用">
              <Button
                icon={<LogoutOutlined />}
                onClick={handleQuit}
                size="middle"
                danger
              />
            </Tooltip>
          </Space>
        </Header>

        <Content style={{ padding: '24px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            style={{ backgroundColor: '#fff', padding: '0 24px', borderRadius: 8 }}
          />
        </Content>
      </Layout>

      <TaskForm
        open={formOpen}
        task={editingTask}
        defaultTime={defaultTaskTime}
        templateData={templateTaskData}
        onTemplateDataApplied={() => setTemplateTaskData(null)}
        onCancel={() => {
          setFormOpen(false)
          setEditingTask(null)
          setDefaultTaskTime(null)
          setTemplateTaskData(null)
        }}
        onSubmit={handleFormSubmit}
      />

      <QuickTaskForm
        open={quickFormOpen}
        onCancel={() => setQuickFormOpen(false)}
        onSubmit={handleQuickFormSubmit}
      />

      <NaturalLanguageTaskForm
        open={nlpFormOpen}
        onCancel={() => setNlpFormOpen(false)}
        onSubmit={handleNLPFormSubmit}
        onVocabManagerOpen={() => {
          setNlpFormOpen(false)
          setVocabManagerOpen(true)
        }}
      />

      <VocabManager
        open={vocabManagerOpen}
        onCancel={() => setVocabManagerOpen(false)}
      />

      <NotificationModal
        open={notificationOpen}
        reminder={currentReminder}
        onClose={handleNotificationClose}
        onSnooze={handleSnooze}
      />

      <FullscreenReminder
        reminder={fullscreenReminder}
        onClose={handleFullscreenClose}
        onSnooze={handleFullscreenSnooze}
      />

      <TaskDetailPanel
        open={detailPanelOpen}
        task={viewingTask}
        onClose={handleCloseDetail}
        onEdit={(task) => {
          handleCloseDetail()
          handleEditTask(task)
        }}
        onDelete={handleDeleteTask}
        onToggle={handleToggleTask}
        onUpdate={handleUpdateTaskFromDetail}
      />

      <OKRForm
        open={okrFormOpen}
        objective={editingObjective}
        tasks={tasks}
        onCancel={() => {
          setOkrFormOpen(false)
          setEditingObjective(null)
        }}
        onSubmit={handleOKRFormSubmit}
      />

      <OKRDetailPanel
        open={okrDetailOpen}
        objective={viewingObjective}
        tasks={tasks}
        onClose={handleCloseOKRDetail}
        onEdit={handleEditObjective}
        onEditKR={handleEditKR}
        onDeleteKR={handleDeleteKR}
        onUpdateKRProgress={handleUpdateKRProgress}
        onAddKR={handleAddKRToObjective}
      />
    </ConfigProvider>
  )
}

export default App
