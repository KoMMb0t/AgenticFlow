const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── Init ─────────────────────────────────────────────
  onAppReady:      cb => ipcRenderer.on('app-ready',      (_, d) => cb(d)),
  onWindowResized: cb => ipcRenderer.on('window-resized', ()    => cb()),

  // ── Layout ───────────────────────────────────────────
  updateLayout: bounds => ipcRenderer.send('update-layout', bounds),

  // ── Connectors (left panel) ──────────────────────────
  addConnector:       data => ipcRenderer.invoke('add-connector', data),
  removeConnector:    id   => ipcRenderer.send('remove-connector', id),
  onConnectorRemoved: cb   => ipcRenderer.on('connector-removed', (_, id) => cb(id)),

  // ── Right apps ───────────────────────────────────────
  addRightApp:       data => ipcRenderer.invoke('add-right-app', data),
  removeRightApp:    id   => ipcRenderer.send('remove-right-app', id),
  onRightAppRemoved: cb   => ipcRenderer.on('right-app-removed', (_, id) => cb(id)),

  // ── Switching ────────────────────────────────────────
  switchCenter:  id => ipcRenderer.send('switch-center', id),
  switchRight:   id => ipcRenderer.send('switch-right',  id),

  // ── Panel collapse ───────────────────────────────────
  setLeftCollapsed:  v => ipcRenderer.send('set-left-collapsed',  v),
  setRightCollapsed: v => ipcRenderer.send('set-right-collapsed', v),

  // ── View actions ─────────────────────────────────────
  reloadView:    (panel, id) => ipcRenderer.send('reload-view',    { panel, instanceId: id }),
  logoutAccount: (panel, id) => ipcRenderer.send('logout-account', { panel, instanceId: id }),

  // ── Projects ─────────────────────────────────────────
  projectsGet:    ()      => ipcRenderer.invoke('projects-get'),
  projectCreate:  p       => ipcRenderer.invoke('project-create', p),
  projectUpdate:  (id, u) => ipcRenderer.invoke('project-update', { id, updates: u }),
  setActiveProject: id    => ipcRenderer.send('set-active-project', id),
  projectAddMessage: (pid, msg) => ipcRenderer.send('project-add-message', { projectId: pid, message: msg }),

  // ── Claude API ───────────────────────────────────────
  claudeMessage: params => ipcRenderer.invoke('claude-message', params),
  claudeStream:  (params, onChunk, onDone, onError) => {
    const streamId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    ipcRenderer.send('claude-stream', { ...params, streamId });
    const cleanChunk = ipcRenderer.on(`claude-stream-chunk:${streamId}`, (_, d) => onChunk(d.text));
    const cleanDone  = ipcRenderer.on(`claude-stream-done:${streamId}`,  (_, d) => { onDone(d); cleanup(); });
    const cleanErr   = ipcRenderer.on(`claude-stream-error:${streamId}`, (_, d) => { onError(d.error); cleanup(); });
    function cleanup() {
      ipcRenderer.removeAllListeners(`claude-stream-chunk:${streamId}`);
      ipcRenderer.removeAllListeners(`claude-stream-done:${streamId}`);
      ipcRenderer.removeAllListeners(`claude-stream-error:${streamId}`);
    }
    return streamId;
  },
  claudeModels: () => ipcRenderer.invoke('claude-models'),

  // ── API Keys ─────────────────────────────────────────
  saveApiKey:  (service, key) => ipcRenderer.send('save-api-key', { service, key }),
  getApiKeys:  ()              => ipcRenderer.invoke('get-api-keys'),

  // ── Perfect Memory ───────────────────────────────────
  memoryGetAll: ()      => ipcRenderer.invoke('memory-get-all'),
  memorySave:   entry   => ipcRenderer.send('memory-save',   entry),
  memoryDelete: id      => ipcRenderer.send('memory-delete', id),

  // ── Chat history ─────────────────────────────────────
  saveChatMessage:  msg => ipcRenderer.send('save-chat-message', msg),
  clearChatHistory: ()  => ipcRenderer.send('clear-chat-history'),

  // ── Open URL in system browser ───────────────────────
  openExternal: url => ipcRenderer.send('open-external', url),

  // ── Local network ─────────────────────────────────────
  getWifiInfo:    () => ipcRenderer.invoke('get-wifi-info'),
  scanNetwork:    () => ipcRenderer.invoke('scan-network'),
  getBtDevices:   () => ipcRenderer.invoke('get-bt-devices'),
});
