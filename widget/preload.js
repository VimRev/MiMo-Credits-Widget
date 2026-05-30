const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widgetAPI', {
  close: () => ipcRenderer.send('window:close'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  log: (level, message, meta) => ipcRenderer.send('log', level, message, meta),
});
