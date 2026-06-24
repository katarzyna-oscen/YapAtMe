const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  pickDirectory: () => ipcRenderer.invoke('vault:pickDirectory'),
  getStoredVaultPath: () => ipcRenderer.invoke('vault:getStoredPath'),
  setStoredVaultPath: (vaultPath) => ipcRenderer.invoke('vault:setStoredPath', vaultPath),
  clearStoredVaultPath: () => ipcRenderer.invoke('vault:clearStoredPath'),
  statPath: (targetPath) => ipcRenderer.invoke('fs:statPath', targetPath),
  ensureDir: (targetPath) => ipcRenderer.invoke('fs:ensureDir', targetPath),
  readDir: (targetPath) => ipcRenderer.invoke('fs:readDir', targetPath),
  readTextFile: (targetPath) => ipcRenderer.invoke('fs:readTextFile', targetPath),
  writeTextFile: (targetPath, content) => ipcRenderer.invoke('fs:writeTextFile', targetPath, content),
  removeEntry: (targetPath) => ipcRenderer.invoke('fs:removeEntry', targetPath),
  renamePath: (fromPath, toPath) => ipcRenderer.invoke('fs:renamePath', fromPath, toPath),
  httpRequest: (request) => ipcRenderer.invoke('net:httpRequest', request),
})