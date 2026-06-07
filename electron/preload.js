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
  }
})
