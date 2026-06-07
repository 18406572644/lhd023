const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, globalShortcut, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')

let mainWindow = null
let tray = null
let store = null
let registeredHotkeys = new Map()

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

app.whenReady().then(() => {
  try {
    store = new Store()
  } catch (err) {
    console.error('初始化存储失败:', err)
  }
  createWindow()
  createTray()

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
})
