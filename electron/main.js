const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, globalShortcut, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')

let mainWindow = null
let widgetWindow = null
let tray = null
let store = null
let registeredHotkeys = new Map()

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
