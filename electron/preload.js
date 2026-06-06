const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key)
  },
  notify: (title, body) => ipcRenderer.invoke('notify', title, body),
  quit: () => ipcRenderer.invoke('app:quit')
})
