const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key)
  },
  notify: (title, body) => ipcRenderer.invoke('notify', title, body),
  quit: () => ipcRenderer.invoke('app:quit'),
  hotkeys: {
    register: (accelerator, hotkeyId) => ipcRenderer.invoke('hotkey:register', accelerator, hotkeyId),
    unregister: (accelerator) => ipcRenderer.invoke('hotkey:unregister', accelerator),
    unregisterAll: () => ipcRenderer.invoke('hotkey:unregisterAll'),
    onTrigger: (callback) => {
      const handler = (_, hotkeyId) => callback(hotkeyId)
      ipcRenderer.on('hotkey:triggered', handler)
      return () => {
        ipcRenderer.removeListener('hotkey:triggered', handler)
      }
    }
  },
  file: {
    select: (options) => ipcRenderer.invoke('file:select', options),
    open: (filePath) => ipcRenderer.invoke('file:open', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('file:showInFolder', filePath)
  },
  widget: {
    getConfig: () => ipcRenderer.invoke('widget:getConfig'),
    saveConfig: (config) => ipcRenderer.invoke('widget:saveConfig', config),
    show: () => ipcRenderer.invoke('widget:show'),
    hide: () => ipcRenderer.invoke('widget:hide'),
    toggle: () => ipcRenderer.invoke('widget:toggle'),
    setSize: (size) => ipcRenderer.invoke('widget:setSize', size),
    setOpacity: (opacity) => ipcRenderer.invoke('widget:setOpacity', opacity),
    setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('widget:setAlwaysOnTop', alwaysOnTop),
    showMainWindow: () => ipcRenderer.invoke('widget:showMainWindow'),
    close: () => ipcRenderer.invoke('widget:close'),
    broadcastTaskUpdate: () => ipcRenderer.invoke('widget:broadcastTaskUpdate'),
    onTaskUpdateRequested: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('widget:taskUpdateRequested', handler)
      return () => {
        ipcRenderer.removeListener('widget:taskUpdateRequested', handler)
      }
    }
  },
  windowFlash: {
    flashTaskbar: (critical) => ipcRenderer.invoke('window:flashTaskbar', critical),
    stopFlash: () => ipcRenderer.invoke('window:stopFlash')
  },
  windowState: {
    setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('window:setAlwaysOnTop', alwaysOnTop),
    setFullScreen: (fullscreen) => ipcRenderer.invoke('window:setFullScreen', fullscreen),
    focus: () => ipcRenderer.invoke('window:focus'),
    show: () => ipcRenderer.invoke('window:show')
  },
  notificationBadge: {
    setBadge: (count) => ipcRenderer.invoke('badge:set', count),
    clearBadge: () => ipcRenderer.invoke('badge:clear')
  },
  calendar: {
    getAccounts: () => ipcRenderer.invoke('calendar:getAccounts'),
    saveAccounts: (accounts) => ipcRenderer.invoke('calendar:saveAccounts', accounts),
    getCalendars: () => ipcRenderer.invoke('calendar:getCalendars'),
    saveCalendars: (calendars) => ipcRenderer.invoke('calendar:saveCalendars', calendars),
    getEvents: (startTime, endTime) => ipcRenderer.invoke('calendar:getEvents', startTime, endTime),
    saveEvents: (events) => ipcRenderer.invoke('calendar:saveEvents', events),
    getSyncConfig: () => ipcRenderer.invoke('calendar:getSyncConfig'),
    saveSyncConfig: (config) => ipcRenderer.invoke('calendar:saveSyncConfig', config),
    sync: () => ipcRenderer.invoke('calendar:sync'),
    createEvent: (eventData) => ipcRenderer.invoke('calendar:createEvent', eventData),
    updateEvent: (eventId, updates) => ipcRenderer.invoke('calendar:updateEvent', eventId, updates),
    deleteEvent: (eventId) => ipcRenderer.invoke('calendar:deleteEvent', eventId),
    getBusySlots: (startTime, endTime) => ipcRenderer.invoke('calendar:getBusySlots', startTime, endTime),
    suggestFreeTime: (preferredDate, durationMinutes) => ipcRenderer.invoke('calendar:suggestFreeTime', preferredDate, durationMinutes),
    checkConflicts: (taskStartTime, taskEndTime, taskId) => ipcRenderer.invoke('calendar:checkConflicts', taskStartTime, taskEndTime, taskId),
    openMeetingUrl: (url) => ipcRenderer.invoke('calendar:openMeetingUrl', url),
    findMeetingUrl: (text) => ipcRenderer.invoke('calendar:findMeetingUrl', text)
  }
})
