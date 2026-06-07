const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, globalShortcut, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')
const dayjs = require('dayjs')

let mainWindow = null
let widgetWindow = null
let tray = null
let store = null
let registeredHotkeys = new Map()

const CALENDAR_ACCOUNTS_KEY = 'calendar_accounts'
const CALENDARS_KEY = 'calendars'
const CALENDAR_EVENTS_KEY = 'calendar_events'
const CALENDAR_SYNC_CONFIG_KEY = 'calendar_sync_config'

const DEFAULT_CALENDAR_SYNC_CONFIG = {
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

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

const getMockCalendarAccounts = () => [
  {
    id: 'local-calendar-1',
    name: '我的日历',
    type: 'local',
    email: '',
    connected: true,
    connectedAt: new Date().toISOString(),
    color: '#1677ff'
  },
  {
    id: 'outlook-calendar-1',
    name: 'Outlook 日历',
    type: 'outlook',
    email: 'user@example.com',
    connected: true,
    connectedAt: new Date().toISOString(),
    color: '#0078d4'
  }
]

const getMockCalendars = () => [
  {
    id: 'calendar-work',
    accountId: 'outlook-calendar-1',
    name: '工作',
    color: '#1677ff',
    isDefault: true,
    canWrite: true
  },
  {
    id: 'calendar-personal',
    accountId: 'outlook-calendar-1',
    name: '个人',
    color: '#722ed1',
    isDefault: false,
    canWrite: true
  },
  {
    id: 'calendar-family',
    accountId: 'local-calendar-1',
    name: '家庭',
    color: '#eb2f96',
    isDefault: false,
    canWrite: true
  }
]

const getMockCalendarEvents = () => {
  const now = dayjs()
  return [
    {
      id: 'event-team-meeting',
      calendarId: 'calendar-work',
      title: '团队周会',
      description: '讨论本周工作进度和下周计划',
      location: '会议室A',
      startTime: now.add(1, 'day').hour(10).minute(0).second(0).toISOString(),
      endTime: now.add(1, 'day').hour(11).minute(30).second(0).toISOString(),
      isAllDay: false,
      status: 'busy',
      isRecurring: true,
      organizer: 'manager@example.com',
      attendees: ['user@example.com', 'colleague@example.com'],
      onlineMeetingUrl: 'https://teams.microsoft.com/l/meetup-join/...',
      meetingProvider: 'teams',
      source: 'system',
      lastSyncedAt: new Date().toISOString()
    },
    {
      id: 'event-daily-standup',
      calendarId: 'calendar-work',
      title: '每日晨会',
      description: '快速同步工作进度',
      location: '线上',
      startTime: now.hour(9).minute(30).second(0).toISOString(),
      endTime: now.hour(10).minute(0).second(0).toISOString(),
      isAllDay: false,
      status: 'busy',
      isRecurring: true,
      organizer: 'user@example.com',
      attendees: ['team@example.com'],
      onlineMeetingUrl: 'https://zoom.us/j/123456789',
      meetingProvider: 'zoom',
      source: 'system',
      lastSyncedAt: new Date().toISOString()
    },
    {
      id: 'event-lunch',
      calendarId: 'calendar-personal',
      title: '午餐时间',
      startTime: now.hour(12).minute(0).second(0).toISOString(),
      endTime: now.hour(13).minute(0).second(0).toISOString(),
      isAllDay: false,
      status: 'free',
      isRecurring: true,
      source: 'system',
      lastSyncedAt: new Date().toISOString()
    },
    {
      id: 'event-holiday',
      calendarId: 'calendar-family',
      title: '生日聚会',
      description: '家人聚餐庆祝生日',
      location: '家中',
      startTime: now.add(5, 'day').hour(18).minute(0).second(0).toISOString(),
      endTime: now.add(5, 'day').hour(21).minute(0).second(0).toISOString(),
      isAllDay: false,
      status: 'busy',
      isRecurring: false,
      source: 'local',
      lastSyncedAt: new Date().toISOString()
    },
    {
      id: 'event-public-holiday',
      calendarId: 'calendar-work',
      title: '国庆节',
      startTime: now.add(10, 'day').hour(0).minute(0).second(0).toISOString(),
      endTime: now.add(17, 'day').hour(23).minute(59).second(59).toISOString(),
      isAllDay: true,
      status: 'outOfOffice',
      isRecurring: false,
      source: 'system',
      lastSyncedAt: new Date().toISOString()
    }
  ]
}

const getCalendarSyncConfig = () => {
  if (!store) return DEFAULT_CALENDAR_SYNC_CONFIG
  const saved = store.get(CALENDAR_SYNC_CONFIG_KEY)
  return { ...DEFAULT_CALENDAR_SYNC_CONFIG, ...saved }
}

const saveCalendarSyncConfig = (config) => {
  if (!store) return false
  store.set(CALENDAR_SYNC_CONFIG_KEY, config)
  return true
}

const getCalendarAccounts = () => {
  if (!store) return getMockCalendarAccounts()
  const saved = store.get(CALENDAR_ACCOUNTS_KEY)
  return saved || getMockCalendarAccounts()
}

const saveCalendarAccounts = (accounts) => {
  if (!store) return false
  store.set(CALENDAR_ACCOUNTS_KEY, accounts)
  return true
}

const getCalendars = () => {
  if (!store) return getMockCalendars()
  const saved = store.get(CALENDARS_KEY)
  return saved || getMockCalendars()
}

const saveCalendars = (calendars) => {
  if (!store) return false
  store.set(CALENDARS_KEY, calendars)
  return true
}

const getCalendarEvents = () => {
  if (!store) return getMockCalendarEvents()
  const saved = store.get(CALENDAR_EVENTS_KEY)
  return saved || getMockCalendarEvents()
}

const saveCalendarEvents = (events) => {
  if (!store) return false
  store.set(CALENDAR_EVENTS_KEY, events)
  return true
}

const detectVideoMeetingProvider = (url) => {
  if (!url) return null
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('zoom.us') || lowerUrl.includes('zoom.com')) return 'zoom'
  if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('microsoft.com')) return 'teams'
  if (lowerUrl.includes('meet.google.com') || lowerUrl.includes('hangouts')) return 'meet'
  if (lowerUrl.includes('webex.com')) return 'webex'
  return 'other'
}

const findMeetingUrl = (text) => {
  if (!text) return null
  const urlRegex = /https?:\/\/[^\s]+/g
  const urls = text.match(urlRegex) || []
  for (const url of urls) {
    const provider = detectVideoMeetingProvider(url)
    if (provider) {
      return { url, provider }
    }
  }
  return null
}

const getBusySlots = (events, startDate, endDate) => {
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  
  return events.filter(event => {
    const eventStart = dayjs(event.startTime)
    const eventEnd = dayjs(event.endTime)
    const isBusy = event.status === 'busy' || event.status === 'outOfOffice'
    const overlaps = eventStart.isBefore(end) && eventEnd.isAfter(start)
    return isBusy && overlaps
  })
}

const suggestFreeTime = (events, preferredDate, durationMinutes = 60) => {
  const date = dayjs(preferredDate).startOf('day')
  const workingStart = date.hour(9).minute(0)
  const workingEnd = date.hour(18).minute(0)
  
  const busySlots = getBusySlots(events, workingStart.toISOString(), workingEnd.toISOString())
    .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf())
  
  const suggestions = []
  let currentTime = workingStart.clone()
  
  if (busySlots.length === 0) {
    suggestions.push({
      start: currentTime.toISOString(),
      end: currentTime.add(durationMinutes, 'minute').toISOString(),
      score: 100
    })
  }
  
  for (const busy of busySlots) {
    const busyStart = dayjs(busy.startTime)
    const busyEnd = dayjs(busy.endTime)
    
    if (currentTime.isBefore(busyStart)) {
      const gap = busyStart.diff(currentTime, 'minute')
      if (gap >= durationMinutes) {
        suggestions.push({
          start: currentTime.toISOString(),
          end: currentTime.add(durationMinutes, 'minute').toISOString(),
          score: currentTime.hour() >= 10 && currentTime.hour() <= 16 ? 90 : 70
        })
      }
    }
    
    if (busyEnd.isAfter(currentTime)) {
      currentTime = busyEnd.clone()
    }
  }
  
  if (currentTime.isBefore(workingEnd)) {
    const gap = workingEnd.diff(currentTime, 'minute')
    if (gap >= durationMinutes) {
      suggestions.push({
        start: currentTime.toISOString(),
        end: currentTime.add(durationMinutes, 'minute').toISOString(),
        score: 60
      })
    }
  }
  
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3)
}

const syncCalendarEvents = async () => {
  const config = getCalendarSyncConfig()
  if (!config.enabled) {
    return { success: false, message: '日历同步未启用' }
  }
  
  try {
    const accounts = getCalendarAccounts().filter(a => a.connected)
    const calendars = getCalendars().filter(c => 
      config.calendarsToSync.includes(c.id) || config.calendarsToSync.length === 0
    )
    
    let events = getCalendarEvents()
    const mockEvents = getMockCalendarEvents()
    
    const now = dayjs()
    const syncStart = now.subtract(config.syncPastDays, 'day')
    const syncEnd = now.add(config.syncFutureDays, 'day')
    
    const filteredMockEvents = mockEvents.filter(event => {
      if (event.isAllDay && !config.syncAllDayEvents) return false
      const eventStart = dayjs(event.startTime)
      const eventEnd = dayjs(event.endTime)
      return eventStart.isBefore(syncEnd) && eventEnd.isAfter(syncStart)
    })
    
    for (const mockEvent of filteredMockEvents) {
      const existingIndex = events.findIndex(e => e.id === mockEvent.id)
      if (existingIndex >= 0) {
        events[existingIndex] = { ...events[existingIndex], ...mockEvent, lastSyncedAt: new Date().toISOString() }
      } else {
        events.push({ ...mockEvent, lastSyncedAt: new Date().toISOString() })
      }
    }
    
    events = events.filter(event => {
      const eventStart = dayjs(event.startTime)
      return eventStart.isAfter(syncStart.subtract(1, 'day'))
    })
    
    saveCalendarEvents(events)
    
    return {
      success: true,
      message: `同步成功，共 ${events.length} 个事件`,
      eventsCount: events.length,
      calendarsCount: calendars.length
    }
  } catch (err) {
    console.error('日历同步失败:', err)
    return { success: false, message: err.message }
  }
}

const createCalendarEvent = async (eventData) => {
  try {
    const config = getCalendarSyncConfig()
    const calendarId = eventData.calendarId || config.defaultCalendarId
    
    const meetingInfo = findMeetingUrl(eventData.description || '') || findMeetingUrl(eventData.location || '')
    
    const newEvent = {
      id: 'event-' + generateId(),
      calendarId: calendarId,
      title: eventData.title,
      description: eventData.description || '',
      location: eventData.location || '',
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      isAllDay: eventData.isAllDay || false,
      status: eventData.status || 'busy',
      isRecurring: false,
      onlineMeetingUrl: meetingInfo?.url,
      meetingProvider: meetingInfo?.provider,
      source: 'local',
      lastSyncedAt: new Date().toISOString(),
      etag: generateId()
    }
    
    const events = getCalendarEvents()
    events.push(newEvent)
    saveCalendarEvents(events)
    
    return { success: true, event: newEvent }
  } catch (err) {
    console.error('创建日历事件失败:', err)
    return { success: false, message: err.message }
  }
}

const updateCalendarEvent = async (eventId, updates) => {
  try {
    const events = getCalendarEvents()
    const eventIndex = events.findIndex(e => e.id === eventId)
    
    if (eventIndex < 0) {
      return { success: false, message: '事件不存在' }
    }
    
    const meetingInfo = findMeetingUrl(updates.description || '') || findMeetingUrl(updates.location || '')
    
    events[eventIndex] = {
      ...events[eventIndex],
      ...updates,
      onlineMeetingUrl: meetingInfo?.url || events[eventIndex].onlineMeetingUrl,
      meetingProvider: meetingInfo?.provider || events[eventIndex].meetingProvider,
      lastSyncedAt: new Date().toISOString(),
      syncDirty: true
    }
    
    saveCalendarEvents(events)
    
    return { success: true, event: events[eventIndex] }
  } catch (err) {
    console.error('更新日历事件失败:', err)
    return { success: false, message: err.message }
  }
}

const deleteCalendarEvent = async (eventId) => {
  try {
    const events = getCalendarEvents()
    const filteredEvents = events.filter(e => e.id !== eventId)
    saveCalendarEvents(filteredEvents)
    return { success: true }
  } catch (err) {
    console.error('删除日历事件失败:', err)
    return { success: false, message: err.message }
  }
}

const checkConflicts = (taskStartTime, taskEndTime, taskId = '') => {
  const events = getCalendarEvents()
  const taskStart = dayjs(taskStartTime)
  const taskEnd = dayjs(taskEndTime)
  
  const conflicts = []
  
  for (const event of events) {
    if (event.source === 'local' && event.id === taskId) continue
    
    const eventStart = dayjs(event.startTime)
    const eventEnd = dayjs(event.endTime)
    
    const overlapStart = taskStart.isAfter(eventStart) ? taskStart : eventStart
    const overlapEnd = taskEnd.isBefore(eventEnd) ? taskEnd : eventEnd
    
    if (overlapStart.isBefore(overlapEnd)) {
      const overlapMinutes = overlapEnd.diff(overlapStart, 'minute')
      const taskDuration = taskEnd.diff(taskStart, 'minute')
      const overlapRatio = overlapMinutes / taskDuration
      
      conflicts.push({
        taskId: taskId,
        taskTitle: '',
        eventId: event.id,
        eventTitle: event.title,
        overlappingStart: overlapStart.toISOString(),
        overlappingEnd: overlapEnd.toISOString(),
        severity: overlapRatio > 0.5 ? 'conflict' : 'warning'
      })
    }
  }
  
  return conflicts
}

const WIDGET_SIZES = {
  small: { width: 280, height: 320, maxTasks: 3 },
  medium: { width: 340, height: 480, maxTasks: 6 },
  large: { width: 400, height: 600, maxTasks: 10 }
}

const DEFAULT_WIDGET_CONFIG = {
  enabled: false,
  size: 'medium',
  opacity: 0.9,
  position: { x: 100, y: 100 },
  alwaysOnTop: true
}

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    frame: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      mainWindow.hide()
    }
    return false
  })
}

function createTray() {
  try {
    const trayIcon = nativeImage.createEmpty()
    tray = new Tray(trayIcon)
    tray.setToolTip('任务提醒')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开主界面',
        click: () => {
          if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      },
      {
        label: '桌面小组件',
        submenu: [
          {
            label: '显示/隐藏小组件',
            click: () => {
              const config = getWidgetConfig()
              if (widgetWindow && widgetWindow.isVisible()) {
                widgetWindow.hide()
                saveWidgetConfig({ ...config, enabled: false })
              } else {
                createWidgetWindow()
                saveWidgetConfig({ ...config, enabled: true })
              }
            }
          },
          { type: 'separator' },
          {
            label: '小尺寸',
            type: 'radio',
            click: () => {
              ipcMain.emit('widget:setSize', {}, 'small')
            }
          },
          {
            label: '中尺寸',
            type: 'radio',
            checked: true,
            click: () => {
              ipcMain.emit('widget:setSize', {}, 'medium')
            }
          },
          {
            label: '大尺寸',
            type: 'radio',
            click: () => {
              ipcMain.emit('widget:setSize', {}, 'large')
            }
          }
        ]
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.isQuiting = true
          app.quit()
        }
      }
    ])

    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
  } catch (err) {
    console.error('创建托盘失败:', err)
  }
}

function getWidgetConfig() {
  if (!store) return DEFAULT_WIDGET_CONFIG
  const saved = store.get('widget_config')
  return { ...DEFAULT_WIDGET_CONFIG, ...saved }
}

function saveWidgetConfig(config) {
  if (!store) return
  store.set('widget_config', config)
}

function createWidgetWindow() {
  if (widgetWindow) {
    widgetWindow.show()
    return
  }

  const config = getWidgetConfig()
  const sizeConfig = WIDGET_SIZES[config.size] || WIDGET_SIZES.medium

  widgetWindow = new BrowserWindow({
    width: sizeConfig.width,
    height: sizeConfig.height,
    x: config.position.x,
    y: config.position.y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: config.alwaysOnTop,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  widgetWindow.setOpacity(config.opacity)

  if (isDev) {
    widgetWindow.loadURL('http://localhost:5173/widget.html')
  } else {
    widgetWindow.loadFile(path.join(__dirname, '../dist/widget.html'))
  }

  widgetWindow.on('moved', () => {
    if (widgetWindow) {
      const [x, y] = widgetWindow.getPosition()
      const currentConfig = getWidgetConfig()
      const newConfig = { ...currentConfig, position: { x, y } }
      saveWidgetConfig(newConfig)
    }
  })

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })

  widgetWindow.on('close', (e) => {
    if (!app.isQuiting && !widgetWindow._forceClose) {
      e.preventDefault()
      widgetWindow.hide()
    }
  })
}

function destroyWidgetWindow() {
  if (widgetWindow) {
    widgetWindow._forceClose = true
    widgetWindow.close()
    widgetWindow = null
  }
}

function showNotification(title, body) {
  try {
    const notification = new Notification({
      title: title,
      body: body,
      silent: false
    })
    notification.show()

    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      }
    })
  } catch (err) {
    console.error('通知失败:', err)
  }
}

ipcMain.handle('store:get', (_, key) => {
  try {
    if (!store) return null
    return store.get(key)
  } catch (err) {
    console.error('store:get error:', err)
    return null
  }
})

ipcMain.handle('store:set', (_, key, value) => {
  try {
    if (!store) return false
    store.set(key, value)
    return true
  } catch (err) {
    console.error('store:set error:', err)
    return false
  }
})

ipcMain.handle('store:delete', (_, key) => {
  try {
    if (!store) return false
    store.delete(key)
    return true
  } catch (err) {
    console.error('store:delete error:', err)
    return false
  }
})

ipcMain.handle('notify', (_, title, body) => {
  showNotification(title, body)
  return true
})

ipcMain.handle('app:quit', () => {
  app.isQuiting = true
  app.quit()
})

ipcMain.handle('hotkey:register', (_, accelerator, hotkeyId) => {
  try {
    if (registeredHotkeys.has(accelerator)) {
      globalShortcut.unregister(accelerator)
    }

    const success = globalShortcut.register(accelerator, () => {
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('hotkey:triggered', hotkeyId)
      }
    })

    if (success) {
      registeredHotkeys.set(accelerator, hotkeyId)
      console.log(`热键注册成功: ${accelerator} -> ${hotkeyId}`)
    } else {
      console.log(`热键注册失败: ${accelerator}`)
    }

    return success
  } catch (err) {
    console.error('热键注册错误:', err)
    return false
  }
})

ipcMain.handle('hotkey:unregister', (_, accelerator) => {
  try {
    globalShortcut.unregister(accelerator)
    registeredHotkeys.delete(accelerator)
    console.log(`热键已注销: ${accelerator}`)
  } catch (err) {
    console.error('热键注销错误:', err)
  }
})

ipcMain.handle('hotkey:unregisterAll', () => {
  try {
    globalShortcut.unregisterAll()
    registeredHotkeys.clear()
    console.log('所有热键已注销')
  } catch (err) {
    console.error('注销所有热键错误:', err)
  }
})

ipcMain.handle('file:select', async (_, options = {}) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options.title || '选择文件',
      properties: ['openFile', ...(options.multiple ? ['multiSelections'] : [])],
      filters: options.filters
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const filePaths = result.filePaths
    const files = filePaths.map(filePath => {
      try {
        const stats = fs.statSync(filePath)
        return {
          name: path.basename(filePath),
          path: filePath,
          size: stats.size
        }
      } catch (err) {
        return {
          name: path.basename(filePath),
          path: filePath,
          size: null
        }
      }
    })
    return options.multiple ? files : files[0]
  } catch (err) {
    console.error('file:select error:', err)
    return null
  }
})

ipcMain.handle('file:open', (_, filePath) => {
  try {
    shell.openPath(filePath)
    return true
  } catch (err) {
    console.error('file:open error:', err)
    return false
  }
})

ipcMain.handle('file:showInFolder', (_, filePath) => {
  try {
    shell.showItemInFolder(filePath)
    return true
  } catch (err) {
    console.error('file:showInFolder error:', err)
    return false
  }
})

ipcMain.handle('widget:getConfig', () => {
  return getWidgetConfig()
})

ipcMain.handle('widget:saveConfig', (_, config) => {
  saveWidgetConfig(config)
  return true
})

ipcMain.handle('widget:show', () => {
  createWidgetWindow()
  const config = getWidgetConfig()
  saveWidgetConfig({ ...config, enabled: true })
  return true
})

ipcMain.handle('widget:hide', () => {
  if (widgetWindow) {
    widgetWindow.hide()
  }
  const config = getWidgetConfig()
  saveWidgetConfig({ ...config, enabled: false })
  return true
})

ipcMain.handle('widget:toggle', () => {
  const config = getWidgetConfig()
  if (widgetWindow && widgetWindow.isVisible()) {
    widgetWindow.hide()
    saveWidgetConfig({ ...config, enabled: false })
    return false
  } else {
    createWidgetWindow()
    saveWidgetConfig({ ...config, enabled: true })
    return true
  }
})

ipcMain.handle('widget:setSize', (_, size) => {
  const config = getWidgetConfig()
  const newConfig = { ...config, size }
  saveWidgetConfig(newConfig)

  if (widgetWindow) {
    const sizeConfig = WIDGET_SIZES[size] || WIDGET_SIZES.medium
    widgetWindow.setSize(sizeConfig.width, sizeConfig.height)
  }
  return true
})

ipcMain.handle('widget:setOpacity', (_, opacity) => {
  const config = getWidgetConfig()
  const newConfig = { ...config, opacity }
  saveWidgetConfig(newConfig)

  if (widgetWindow) {
    widgetWindow.setOpacity(opacity)
  }
  return true
})

ipcMain.handle('widget:setAlwaysOnTop', (_, alwaysOnTop) => {
  const config = getWidgetConfig()
  const newConfig = { ...config, alwaysOnTop }
  saveWidgetConfig(newConfig)

  if (widgetWindow) {
    widgetWindow.setAlwaysOnTop(alwaysOnTop)
  }
  return true
})

ipcMain.handle('widget:startDrag', () => {
  if (widgetWindow) {
    widgetWindow.webContents.executeJavaScript('window.startWidgetDrag && window.startWidgetDrag()')
  }
  return true
})

ipcMain.handle('widget:showMainWindow', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
  return true
})

ipcMain.handle('widget:close', () => {
  if (widgetWindow) {
    widgetWindow.hide()
    const config = getWidgetConfig()
    saveWidgetConfig({ ...config, enabled: false })
  }
  return true
})

ipcMain.handle('widget:broadcastTaskUpdate', () => {
  if (mainWindow) {
    mainWindow.webContents.send('widget:taskUpdateRequested')
  }
  if (widgetWindow) {
    widgetWindow.webContents.send('widget:taskUpdateRequested')
  }
  return true
})

ipcMain.handle('window:flashTaskbar', (_, critical = false) => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) {
      mainWindow.showInactive()
    }
    mainWindow.flashFrame(true)
    if (critical) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
      mainWindow.focus()
    }
  }
  return true
})

ipcMain.handle('window:stopFlash', () => {
  if (mainWindow) {
    mainWindow.flashFrame(false)
    mainWindow.setAlwaysOnTop(false)
  }
  return true
})

ipcMain.handle('window:setAlwaysOnTop', (_, alwaysOnTop = false) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(alwaysOnTop, alwaysOnTop ? 'screen-saver' : 'normal')
  }
  return true
})

ipcMain.handle('window:setFullScreen', (_, fullscreen = false) => {
  if (mainWindow) {
    mainWindow.setFullScreen(fullscreen)
    if (fullscreen) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
      mainWindow.focus()
    }
  }
  return true
})

ipcMain.handle('window:focus', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
  return true
})

ipcMain.handle('window:show', () => {
  if (mainWindow) {
    mainWindow.show()
  }
  return true
})

ipcMain.handle('badge:set', (_, count) => {
  try {
    if (process.platform === 'darwin') {
      app.dock.setBadge(count > 0 ? String(count) : '')
    } else if (mainWindow && tray) {
      if (count > 0) {
        mainWindow.setOverlayIcon(null, `待处理提醒: ${count}`)
        const badgeIcon = createBadgeIcon(count)
        if (badgeIcon) {
          tray.setImage(badgeIcon)
        }
      } else {
        mainWindow.setOverlayIcon(null, '')
        const trayIcon = nativeImage.createEmpty()
        tray.setImage(trayIcon)
      }
    }
  } catch (err) {
    console.error('设置徽章失败:', err)
  }
  return true
})

ipcMain.handle('badge:clear', () => {
  try {
    if (process.platform === 'darwin') {
      app.dock.setBadge('')
    } else if (mainWindow && tray) {
      mainWindow.setOverlayIcon(null, '')
      const trayIcon = nativeImage.createEmpty()
      tray.setImage(trayIcon)
    }
  } catch (err) {
    console.error('清除徽章失败:', err)
  }
  return true
})

ipcMain.handle('calendar:getAccounts', () => {
  try {
    return getCalendarAccounts()
  } catch (err) {
    console.error('获取日历账户失败:', err)
    return []
  }
})

ipcMain.handle('calendar:saveAccounts', (_, accounts) => {
  try {
    return saveCalendarAccounts(accounts)
  } catch (err) {
    console.error('保存日历账户失败:', err)
    return false
  }
})

ipcMain.handle('calendar:getCalendars', () => {
  try {
    return getCalendars()
  } catch (err) {
    console.error('获取日历列表失败:', err)
    return []
  }
})

ipcMain.handle('calendar:saveCalendars', (_, calendars) => {
  try {
    return saveCalendars(calendars)
  } catch (err) {
    console.error('保存日历列表失败:', err)
    return false
  }
})

ipcMain.handle('calendar:getEvents', (_, startTime, endTime) => {
  try {
    let events = getCalendarEvents()
    if (startTime && endTime) {
      const start = dayjs(startTime)
      const end = dayjs(endTime)
      events = events.filter(event => {
        const eventStart = dayjs(event.startTime)
        const eventEnd = dayjs(event.endTime)
        return eventStart.isBefore(end) && eventEnd.isAfter(start)
      })
    }
    return events
  } catch (err) {
    console.error('获取日历事件失败:', err)
    return []
  }
})

ipcMain.handle('calendar:saveEvents', (_, events) => {
  try {
    return saveCalendarEvents(events)
  } catch (err) {
    console.error('保存日历事件失败:', err)
    return false
  }
})

ipcMain.handle('calendar:getSyncConfig', () => {
  try {
    return getCalendarSyncConfig()
  } catch (err) {
    console.error('获取同步配置失败:', err)
    return DEFAULT_CALENDAR_SYNC_CONFIG
  }
})

ipcMain.handle('calendar:saveSyncConfig', (_, config) => {
  try {
    return saveCalendarSyncConfig(config)
  } catch (err) {
    console.error('保存同步配置失败:', err)
    return false
  }
})

ipcMain.handle('calendar:sync', async () => {
  return await syncCalendarEvents()
})

ipcMain.handle('calendar:createEvent', async (_, eventData) => {
  return await createCalendarEvent(eventData)
})

ipcMain.handle('calendar:updateEvent', async (_, eventId, updates) => {
  return await updateCalendarEvent(eventId, updates)
})

ipcMain.handle('calendar:deleteEvent', async (_, eventId) => {
  return await deleteCalendarEvent(eventId)
})

ipcMain.handle('calendar:getBusySlots', (_, startTime, endTime) => {
  try {
    const events = getCalendarEvents()
    return getBusySlots(events, startTime, endTime)
  } catch (err) {
    console.error('获取忙碌时段失败:', err)
    return []
  }
})

ipcMain.handle('calendar:suggestFreeTime', (_, preferredDate, durationMinutes) => {
  try {
    const events = getCalendarEvents()
    return suggestFreeTime(events, preferredDate, durationMinutes)
  } catch (err) {
    console.error('建议空闲时间失败:', err)
    return []
  }
})

ipcMain.handle('calendar:checkConflicts', (_, taskStartTime, taskEndTime, taskId) => {
  try {
    return checkConflicts(taskStartTime, taskEndTime, taskId)
  } catch (err) {
    console.error('检查冲突失败:', err)
    return []
  }
})

ipcMain.handle('calendar:openMeetingUrl', (_, url) => {
  try {
    if (url) {
      shell.openExternal(url)
      return true
    }
    return false
  } catch (err) {
    console.error('打开会议链接失败:', err)
    return false
  }
})

ipcMain.handle('calendar:findMeetingUrl', (_, text) => {
  try {
    return findMeetingUrl(text)
  } catch (err) {
    console.error('查找会议链接失败:', err)
    return null
  }
})

function createBadgeIcon(count) {
  try {
    const displayCount = count > 99 ? '99+' : String(count)
    const size = 32
    const canvas = Buffer.alloc(size * size * 4)
    
    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 2
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - centerX
        const dy = y - centerY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const idx = (y * size + x) * 4
        
        if (dist <= radius) {
          canvas[idx] = 255
          canvas[idx + 1] = 77
          canvas[idx + 2] = 79
          canvas[idx + 3] = 255
        } else {
          canvas[idx] = 0
          canvas[idx + 1] = 0
          canvas[idx + 2] = 0
          canvas[idx + 3] = 0
        }
      }
    }
    
    const icon = nativeImage.createFromBuffer(canvas, {
      width: size,
      height: size
    })
    
    return icon
  } catch (err) {
    console.error('创建徽章图标失败:', err)
    return null
  }
}

app.whenReady().then(() => {
  try {
    store = new Store()
  } catch (err) {
    console.error('初始化存储失败:', err)
  }
  createWindow()
  createTray()

  const widgetConfig = getWidgetConfig()
  if (widgetConfig.enabled) {
    setTimeout(() => {
      createWidgetWindow()
    }, 1000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  registeredHotkeys.clear()
  destroyWidgetWindow()
})
