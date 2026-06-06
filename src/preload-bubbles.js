const { contextBridge, ipcRenderer } = require('electron');

// Gruppen-ID aus den Fenster-Argumenten lesen
const groupArg = process.argv.find(a => a.startsWith('--bubble-group='));
const groupId  = groupArg ? groupArg.split('=')[1] : null;

contextBridge.exposeInMainWorld('bubbleApi', {
  groupId,
  getState:    ()        => ipcRenderer.invoke('bubbles-state'),
  saveBubble:  b         => ipcRenderer.invoke('bubble-save', b),
  deleteBubble: id       => ipcRenderer.invoke('bubble-delete', id),
  saveGroup:   g         => ipcRenderer.invoke('bubble-group-save', g),
  deleteGroup: id        => ipcRenderer.invoke('bubble-group-delete', id),
  run:         (bubbleId, messages) => ipcRenderer.invoke('bubble-run', { bubbleId, messages }),
  expand:      expanded  => ipcRenderer.send('bubblebar-expand', expanded),
  onChanged:   cb        => ipcRenderer.on('bubbles-changed', () => cb()),
});
