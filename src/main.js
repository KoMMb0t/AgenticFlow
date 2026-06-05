/**
 * AgenticFlow — Main Process
 * 3-Panel: Links (Clouds/Konneктoren) | Mitte (Chat/Projekt) | Rechts (Agenten/Apps)
 */

const { app, BrowserWindow, BrowserView, ipcMain, session, Menu, shell } = require('electron');
const path  = require('path');
const Store = require('electron-store');
const { registerHandlers }    = require('./claude-api');
const { registerBleHandlers } = require('./ble');

const store = new Store({
  defaults: {
    windowBounds:    { width: 1500, height: 950 },
    leftCollapsed:   false,
    rightCollapsed:  false,
    leftWidth:       260,
    rightWidth:      360,
    connectors:      [],          // left-panel cloud/service connectors
    rightApps:       [],          // right-panel agent/browser apps
    activeCenterId:  null,        // null = project/chat mode
    activeRightId:   null,
    projects:        [],
    activeProjectId: null,
    perfectMemory:   [],
    apiKeys:         {},
    chatHistory:     [],
  }
});

// Register Claude API & memory handlers
registerHandlers(store);
registerBleHandlers(store);

// ── Connector templates (left sidebar) ──────────────────────
const CONNECTOR_TEMPLATES = [
  // ☁ Cloud Storage
  { id: 'google-drive', name: 'Google Drive',  url: 'https://drive.google.com',     icon: '📁', color: '#0f9d58', cat: 'cloud'   },
  { id: 'onedrive',     name: 'OneDrive',       url: 'https://onedrive.live.com',    icon: '☁',  color: '#0078d4', cat: 'cloud'   },
  { id: 'dropbox',      name: 'Dropbox',        url: 'https://dropbox.com',          icon: '📦', color: '#0061ff', cat: 'cloud'   },
  { id: 'terabox',      name: 'TeraBox',        url: 'https://www.terabox.com',      icon: '🗃',  color: '#ff6b35', cat: 'cloud'   },
  { id: 'mega',         name: 'MEGA',           url: 'https://mega.nz',             icon: '🔒', color: '#d9272e', cat: 'cloud'   },
  { id: 'nextcloud',    name: 'Nextcloud',      url: '',                            icon: '🌩',  color: '#0082c9', cat: 'cloud'   },
  { id: 'icloud',       name: 'iCloud',         url: 'https://www.icloud.com',      icon: '🍎', color: '#888',    cat: 'cloud'   },
  // 📧 Kommunikation
  { id: 'gmail',           name: 'Gmail',            url: 'https://mail.google.com',              icon: '✉',  color: '#ea4335', cat: 'comms'   },
  { id: 'outlook',         name: 'Outlook',          url: 'https://outlook.live.com',             icon: '📧', color: '#0078d4', cat: 'comms'   },
  { id: 'protonmail',      name: 'ProtonMail',       url: 'https://mail.proton.me',               icon: '🛡',  color: '#6d4aff', cat: 'comms'   },
  { id: 'infomaniak-mail', name: 'Infomaniak Mail',  url: 'https://mail.infomaniak.com',          icon: '📮', color: '#1a73e8', cat: 'comms'   },
  // 🔧 Entwicklung / Tools
  { id: 'github',          name: 'GitHub',           url: 'https://github.com',                   icon: '⚡', color: '#58a6ff', cat: 'dev'     },
  { id: 'gitlab',          name: 'GitLab',           url: 'https://gitlab.com',                   icon: '🦊', color: '#fc6d26', cat: 'dev'     },
  { id: 'bitbucket',       name: 'Bitbucket',        url: 'https://bitbucket.org',                icon: '🪣', color: '#0052cc', cat: 'dev'     },
  { id: 'google-cloud',    name: 'Google Cloud',     url: 'https://console.cloud.google.com',     icon: '☁',  color: '#4285f4', cat: 'dev'     },
  { id: 'notion',       name: 'Notion',         url: 'https://notion.so',           icon: 'N',  color: '#fff',    cat: 'tool'    },
  { id: 'trello',       name: 'Trello',         url: 'https://trello.com',          icon: '📋', color: '#0052cc', cat: 'tool'    },
  { id: 'figma',        name: 'Figma',          url: 'https://figma.com',           icon: '🎨', color: '#a259ff', cat: 'tool'    },
  { id: 'custom',       name: 'Benutzerdefiniert', url: '',                         icon: '⚙',  color: '#888',    cat: 'custom'  },
];

// ── Right panel templates (agents & apps) ──────────────────
const RIGHT_TEMPLATES = [
  // 🤖 KI-Agenten
  { id: 'manus',        name: 'Manus',          url: 'https://manus.im',             icon: 'M',  color: '#6c63ff', cat: 'ai'      },
  { id: 'chatgpt',      name: 'ChatGPT',        url: 'https://chat.openai.com',      icon: '🤖', color: '#10a37f', cat: 'ai'      },
  { id: 'gemini',       name: 'Gemini',         url: 'https://gemini.google.com',    icon: '✦',  color: '#4285f4', cat: 'ai'      },
  { id: 'claude-web',   name: 'Claude',         url: 'https://claude.ai',            icon: '⚗',  color: '#cc785c', cat: 'ai'      },
  { id: 'perplexity',   name: 'Perplexity',     url: 'https://perplexity.ai',        icon: '◎',  color: '#20808d', cat: 'ai'      },
  { id: 'copilot',      name: 'Copilot',        url: 'https://copilot.microsoft.com',icon: '◈',  color: '#0078d4', cat: 'ai'      },
  { id: 'grok',         name: 'Grok',           url: 'https://grok.com',             icon: 'X',  color: '#aaa',    cat: 'ai'      },
  { id: 'monica',       name: 'Monica',         url: 'https://monica.im',            icon: '🌸', color: '#ff6b9d', cat: 'ai'      },
  // 💬 Kommunikation
  { id: 'slack',        name: 'Slack',          url: 'https://app.slack.com',        icon: 'S',  color: '#4a154b', cat: 'comms'   },
  { id: 'discord',      name: 'Discord',        url: 'https://discord.com/app',      icon: 'D',  color: '#5865f2', cat: 'comms'   },
  { id: 'telegram',     name: 'Telegram',       url: 'https://web.telegram.org',     icon: 'T',  color: '#0088cc', cat: 'comms'   },
  { id: 'whatsapp',     name: 'WhatsApp',       url: 'https://web.whatsapp.com',     icon: 'W',  color: '#25d366', cat: 'comms'   },
  { id: 'kchat',        name: 'kChat',          url: 'https://kchat.infomaniak.com', icon: '💬', color: '#1a73e8', cat: 'comms'   },
  { id: 'twitter',      name: 'X / Twitter',    url: 'https://x.com',               icon: 'X',  color: '#e7e9ea', cat: 'social'  },
  { id: 'custom',       name: 'Benutzerdefiniert', url: '',                          icon: '⚙',  color: '#888',    cat: 'custom'  },
];

// ── Window & View management ─────────────────────────────────
let mainWindow      = null;
let centerViews     = new Map(); // connectorId -> BrowserView
let rightViews      = new Map(); // appId       -> BrowserView
let activeCenterId  = store.get('activeCenterId');
let activeRightId   = store.get('activeRightId');
let centerBounds    = null;
let rightBounds     = null;

function createMainWindow() {
  const { width, height } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width, height,
    minWidth: 900, minHeight: 650,
    title: 'AgenticFlow',
    backgroundColor: '#09090f',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.on('resize', () => {
    store.set('windowBounds', mainWindow.getBounds());
    mainWindow.webContents.send('window-resized');
  });
  mainWindow.on('closed', () => { mainWindow = null; centerViews.clear(); rightViews.clear(); });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.on('did-finish-load', initApp);
}

function initApp() {
  const connectors = store.get('connectors');
  const rightApps  = store.get('rightApps');

  connectors.forEach(c => makeCenterView(c));
  rightApps.forEach(a => makeRightView(a));

  mainWindow.webContents.send('app-ready', {
    connectors,
    rightApps,
    activeCenterId,
    activeRightId,
    leftCollapsed:    store.get('leftCollapsed'),
    rightCollapsed:   store.get('rightCollapsed'),
    connTemplates:    CONNECTOR_TEMPLATES,
    rightTemplates:   RIGHT_TEMPLATES,
    projects:         store.get('projects'),
    activeProjectId:  store.get('activeProjectId'),
    apiKeys:          store.get('apiKeys', {}),
    chatHistory:      store.get('chatHistory'),
    perfectMemory:    store.get('perfectMemory', []),
  });
}

// ── BrowserView helpers ──────────────────────────────────────

function makeCenterView(conn) {
  if (centerViews.has(conn.instanceId)) return;
  const v = new BrowserView({ webPreferences: { partition: conn.partition, nodeIntegration: false, contextIsolation: true } });
  if (conn.url) v.webContents.loadURL(conn.url).catch(() => {});
  centerViews.set(conn.instanceId, v);
}

function makeRightView(app) {
  if (rightViews.has(app.instanceId)) return;
  const v = new BrowserView({ webPreferences: { partition: app.partition, nodeIntegration: false, contextIsolation: true } });
  if (app.url) v.webContents.loadURL(app.url).catch(() => {});
  rightViews.set(app.instanceId, v);
}

function refreshViews() {
  if (!mainWindow) return;
  mainWindow.getBrowserViews().forEach(v => mainWindow.removeBrowserView(v));

  if (activeCenterId && centerBounds && centerViews.has(activeCenterId)) {
    const v = centerViews.get(activeCenterId);
    mainWindow.addBrowserView(v);
    v.setBounds(centerBounds);
    v.setAutoResize({ width: true, height: true });
  }

  if (activeRightId && rightBounds && rightViews.has(activeRightId) && !store.get('rightCollapsed')) {
    const v = rightViews.get(activeRightId);
    mainWindow.addBrowserView(v);
    v.setBounds(rightBounds);
    v.setAutoResize({ width: true, height: true });
  }
}

// ── IPC: Layout ──────────────────────────────────────────────

ipcMain.on('update-layout', (_, bounds) => {
  centerBounds = bounds.center || null;
  rightBounds  = bounds.right  || null;
  refreshViews();
});

// ── IPC: Connectors (left) ───────────────────────────────────

ipcMain.handle('add-connector', (_, { templateId, label, customUrl, accountIndex }) => {
  const tpl = CONNECTOR_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return null;

  const instanceId = `conn_${templateId}_${Date.now()}`;
  const conn = {
    instanceId,
    templateId,
    name:         tpl.name,
    label:        label || `Account ${accountIndex || 1}`,
    url:          customUrl || tpl.url,
    icon:         tpl.icon,
    color:        tpl.color,
    cat:          tpl.cat,
    partition:    `persist:${instanceId}`,
  };

  const list = store.get('connectors');
  list.push(conn);
  store.set('connectors', list);
  makeCenterView(conn);
  return conn;
});

ipcMain.on('remove-connector', (_, instanceId) => {
  const v   = centerViews.get(instanceId);
  const all = store.get('connectors');
  const c   = all.find(x => x.instanceId === instanceId);
  if (v) {
    mainWindow.removeBrowserView(v);
    if (c) session.fromPartition(c.partition).clearStorageData().catch(() => {});
    centerViews.delete(instanceId);
  }
  store.set('connectors', all.filter(x => x.instanceId !== instanceId));
  if (activeCenterId === instanceId) {
    activeCenterId = null;
    store.set('activeCenterId', null);
    refreshViews();
  }
  mainWindow.webContents.send('connector-removed', instanceId);
});

// ── IPC: Right apps ──────────────────────────────────────────

ipcMain.handle('add-right-app', (_, { templateId, label, customUrl, accountIndex }) => {
  const tpl = RIGHT_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return null;

  const instanceId = `rapp_${templateId}_${Date.now()}`;
  const appData = {
    instanceId,
    templateId,
    name:      tpl.name,
    label:     label || `Account ${accountIndex || 1}`,
    url:       customUrl || tpl.url,
    icon:      tpl.icon,
    color:     tpl.color,
    cat:       tpl.cat,
    partition: `persist:${instanceId}`,
  };

  const apps = store.get('rightApps');
  apps.push(appData);
  store.set('rightApps', apps);
  makeRightView(appData);
  return appData;
});

ipcMain.on('remove-right-app', (_, instanceId) => {
  const v   = rightViews.get(instanceId);
  const all = store.get('rightApps');
  const a   = all.find(x => x.instanceId === instanceId);
  if (v) {
    mainWindow.removeBrowserView(v);
    if (a) session.fromPartition(a.partition).clearStorageData().catch(() => {});
    rightViews.delete(instanceId);
  }
  store.set('rightApps', all.filter(x => x.instanceId !== instanceId));
  if (activeRightId === instanceId) {
    activeRightId = null;
    store.set('activeRightId', null);
    refreshViews();
  }
  mainWindow.webContents.send('right-app-removed', instanceId);
});

// ── IPC: Switching ───────────────────────────────────────────

ipcMain.on('switch-center', (_, id) => {
  activeCenterId = id;
  store.set('activeCenterId', id);
  refreshViews();
});

ipcMain.on('switch-right', (_, id) => {
  activeRightId = id;
  store.set('activeRightId', id);
  refreshViews();
});

ipcMain.on('set-left-collapsed',  (_, v) => { store.set('leftCollapsed', v); });
ipcMain.on('set-right-collapsed', (_, v) => { store.set('rightCollapsed', v); refreshViews(); });

ipcMain.on('reload-view', (_, { panel, instanceId }) => {
  const map = panel === 'center' ? centerViews : rightViews;
  map.get(instanceId)?.webContents.reload();
});

ipcMain.on('logout-account', (_, { panel, instanceId }) => {
  const map  = panel === 'center' ? centerViews : rightViews;
  const list = panel === 'center' ? store.get('connectors') : store.get('rightApps');
  const acc  = list.find(a => a.instanceId === instanceId);
  if (!acc) return;
  session.fromPartition(acc.partition).clearStorageData()
    .then(() => { map.get(instanceId)?.webContents.loadURL(acc.url).catch(() => {}); })
    .catch(() => {});
});

ipcMain.on('set-active-project', (_, id) => {
  store.set('activeProjectId', id);
});

ipcMain.on('save-chat-message', (_, msg) => {
  const h = store.get('chatHistory');
  h.push(msg);
  if (h.length > 500) h.splice(0, h.length - 500);
  store.set('chatHistory', h);
});

ipcMain.on('clear-chat-history', () => store.set('chatHistory', []));

// Open URL in default system browser (for API key pages)
ipcMain.on('open-external', (_, url) => shell.openExternal(url).catch(() => {}));

// ── Local network / WiFi / Bluetooth ────────────────────────
const { execFile } = require('child_process');

ipcMain.handle('get-wifi-info', () => new Promise(resolve => {
  execFile('netsh', ['wlan', 'show', 'interfaces'], { encoding: 'utf8' }, (err, out) => {
    if (err) return resolve({ name: 'Nicht verbunden', strength: 0 });
    const nameMatch     = out.match(/\s+SSID\s+:\s(.+)/);
    const signalMatch   = out.match(/\s+Signal\s+:\s(\d+)%/);
    resolve({
      name:     nameMatch   ? nameMatch[1].trim()   : 'Nicht verbunden',
      strength: signalMatch ? parseInt(signalMatch[1]) : 0,
    });
  });
}));

ipcMain.handle('scan-network', () => new Promise(resolve => {
  // arp -a gibt alle bekannten Geräte im LAN zurück
  execFile('arp', ['-a'], { encoding: 'utf8' }, (err, out) => {
    if (err) return resolve([]);
    const devices = [];
    const lines = out.split('\n');
    for (const line of lines) {
      const m = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([\w-]+)\s+(\w+)/);
      if (m && m[3] === 'dynamic') {
        devices.push({ ip: m[1], mac: m[2] });
      }
    }
    resolve(devices.slice(0, 12)); // max 12 Geräte
  });
}));

ipcMain.handle('get-bt-devices', () => new Promise(resolve => {
  // PowerShell: Bluetooth-Geräte auflesen
  const ps = 'Get-PnpDevice -Class Bluetooth | Where-Object {$_.Status -eq "OK"} | Select-Object -First 8 FriendlyName,Status | ConvertTo-Json';
  execFile('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }, (err, out) => {
    if (err || !out.trim()) return resolve([]);
    try {
      const raw = JSON.parse(out.trim());
      const arr = Array.isArray(raw) ? raw : [raw];
      resolve(arr.map(d => ({ name: d.FriendlyName, status: d.Status })));
    } catch { resolve([]); }
  });
}));

// ── App lifecycle ────────────────────────────────────────────

app.on('ready', createMainWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createMainWindow(); });
