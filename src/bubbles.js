/**
 * AgenticBubble — positionierbare Bubble-Leisten (AgenticFlow-Erweiterung)
 * Frei auf dem Bildschirm platzierbare, gruppierbare Leisten mit KI-"Bubbles".
 * Jede Gruppe = eigenes frameless Always-on-Top-Fenster (links/rechts andockbar
 * oder frei verschiebbar). Engines: claude | ollama | perplexity | openrouter.
 */

const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let store        = null;
const groupWins  = new Map();   // groupId -> BrowserWindow
let visible      = true;

// ── Defaults ────────────────────────────────────────────────

const DEFAULT_BUBBLES = [
  { id: 'b-chat',      name: 'Chat',      icon: '💬', engine: 'claude',     model: 'claude-sonnet-4-6', systemPrompt: 'Du bist ein schneller, präziser Assistent. Antworte auf Deutsch.', temperature: 0.7, quickActions: [{ label: 'Zusammenfassen', prompt: 'Fasse das zusammen:' }, { label: 'Übersetzen', prompt: 'Übersetze ins Deutsche:' }] },
  { id: 'b-research',  name: 'Recherche', icon: '🔍', engine: 'perplexity', model: 'sonar',             systemPrompt: 'Recherchiere gründlich und nenne Quellen. Deutsch.',              temperature: 0.3, quickActions: [{ label: 'Fakten prüfen', prompt: 'Prüfe diese Aussage auf Fakten:' }] },
  { id: 'b-offline',   name: 'Offline',   icon: '🦙', engine: 'ollama',     model: 'llama3.1',          systemPrompt: 'Du bist ein lokaler Offline-Assistent. Antworte auf Deutsch.',    temperature: 0.7, quickActions: [] },
  { id: 'b-agent',     name: 'Agent',     icon: '🤖', engine: 'claude',     model: 'claude-opus-4-8',   systemPrompt: 'Du bist ein Planungs-Agent: zerlege Aufgaben in Schritte und arbeite sie strukturiert ab. Deutsch.', temperature: 0.5, quickActions: [{ label: 'Plan erstellen', prompt: 'Erstelle einen Schritt-für-Schritt-Plan für:' }] },
];

const DEFAULT_GROUPS = [
  { id: 'g-main', name: 'Haupt', edge: 'right', x: null, y: null, bubbleIds: ['b-chat', 'b-research', 'b-offline', 'b-agent'] },
];

function ensureDefaults() {
  if (!store.get('bubbles'))      store.set('bubbles', DEFAULT_BUBBLES);
  if (!store.get('bubbleGroups')) store.set('bubbleGroups', DEFAULT_GROUPS);
}

// ── Fenster-Verwaltung ──────────────────────────────────────

const BAR_W      = 76;    // eingeklappt (nur Bubbles)
const PANEL_W    = 440;   // ausgeklappt (mit Chat-Panel)
const MIN_H      = 240;

function barBounds(group, expanded) {
  const wa = screen.getPrimaryDisplay().workArea;
  const width  = expanded ? PANEL_W : BAR_W;
  const count  = (group.bubbleIds || []).length;
  const barH   = Math.min(Math.max(MIN_H, 120 + count * 64), wa.height);
  // Chat-Panel: deutlich höher als die Leiste (mehr Platz für Verlauf)
  const height = expanded ? Math.min(Math.max(barH, 620), wa.height) : barH;

  let x, y;
  if (group.edge === 'left')       x = wa.x;
  else if (group.edge === 'right') x = wa.x + wa.width - width;
  else                             x = Number.isFinite(group.x) ? group.x : wa.x + wa.width - width - 40;
  y = Number.isFinite(group.y) ? group.y : wa.y + Math.round((wa.height - height) / 2);

  // Im Arbeitsbereich halten (nie hinter der Taskleiste)
  x = Math.min(Math.max(x, wa.x), wa.x + wa.width  - width);
  y = Math.min(Math.max(y, wa.y), wa.y + wa.height - height);
  return { x, y, width, height };
}

function createGroupWindow(group) {
  if (groupWins.has(group.id)) return groupWins.get(group.id);

  const b = barBounds(group, false);
  const win = new BrowserWindow({
    ...b,
    show: false,                   // erst zeigen, wenn fertig gerendert (ready-to-show)
    frame: false,
    transparent: false,            // transparent + --disable-gpu rendert unsichtbar!
    backgroundColor: '#0e0e18',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    title: `Bubbles — ${group.name}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-bubbles.js'),
      additionalArguments: [`--bubble-group=${group.id}`],
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.loadFile(path.join(__dirname, 'bubblebar.html'));
  win.once('ready-to-show', () => {
    if (visible && !win.isDestroyed()) { win.showInactive(); win.moveTop(); }
  });

  // Position nach Drag merken (frei platziert ⇒ edge='float') + in Arbeitsbereich klemmen
  let moveTimer = null;
  win.on('moved', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const cur = win.getBounds();
      const wa  = screen.getDisplayMatching(cur).workArea;
      // nie hinter die Taskleiste / aus dem Bildschirm
      const x = Math.min(Math.max(cur.x, wa.x), wa.x + wa.width  - cur.width);
      const y = Math.min(Math.max(cur.y, wa.y), wa.y + wa.height - cur.height);
      if (x !== cur.x || y !== cur.y) win.setBounds({ ...cur, x, y });

      const groups = store.get('bubbleGroups', []);
      const g = groups.find(gr => gr.id === group.id);
      if (!g) return;
      // Snap an die Ränder (innerhalb 24px)
      if (x <= wa.x + 24)                              { g.edge = 'left';  g.x = null; }
      else if (x + cur.width >= wa.x + wa.width - 24)  { g.edge = 'right'; g.x = null; }
      else                                             { g.edge = 'float'; g.x = x; }
      g.y = y;
      store.set('bubbleGroups', groups);
    }, 250);
  });
  win.on('closed', () => groupWins.delete(group.id));

  groupWins.set(group.id, win);
  return win;
}

function syncWindows() {
  const groups = store.get('bubbleGroups', []);
  // entfernte Gruppen schließen
  for (const [id, win] of groupWins) {
    if (!groups.find(g => g.id === id)) { win.destroy(); groupWins.delete(id); }
  }
  if (!visible) return;
  for (const g of groups) {
    if (!groupWins.has(g.id)) createGroupWindow(g);
    else {
      const win = groupWins.get(g.id);
      win.webContents.send('bubbles-changed');
    }
  }
}

function toggleBars(show) {
  visible = (typeof show === 'boolean') ? show : !visible;
  if (visible) syncWindows();
  for (const win of groupWins.values()) visible ? win.show() : win.hide();
  return visible;
}

// ── Engine-Router ───────────────────────────────────────────

async function runEngine(bubble, messages) {
  const keys = store.get('apiKeys', {});
  const sys  = bubble.systemPrompt || '';
  const temp = Number.isFinite(bubble.temperature) ? bubble.temperature : 0.7;

  switch (bubble.engine) {
    case 'claude': {
      const key = keys.claude || store.get('claudeApiKey');   // Fallback: alter Store-Name
      if (!key) throw new Error('Kein Claude API-Key gesetzt (Einstellungen in AgenticFlow).');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: bubble.model || 'claude-sonnet-4-6', max_tokens: 4096, temperature: temp, system: sys, messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Claude HTTP ${res.status}`);
      return { text: (data.content || []).map(c => c.text || '').join(''), citations: [] };
    }
    case 'perplexity': {
      const key = keys.perplexity;
      if (!key) throw new Error('Kein Perplexity API-Key gesetzt.');
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: bubble.model || 'sonar', temperature: temp, messages: [{ role: 'system', content: sys }, ...messages] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Perplexity HTTP ${res.status}`);
      return { text: data.choices?.[0]?.message?.content || '', citations: data.citations || [] };
    }
    case 'ollama': {
      const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: bubble.model || 'llama3.1', stream: false, options: { temperature: temp }, messages: [{ role: 'system', content: sys }, ...messages] }),
      }).catch(() => { throw new Error('Ollama nicht erreichbar (läuft es auf localhost:11434?).'); });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Ollama HTTP ${res.status}`);
      return { text: data.message?.content || '', citations: [] };
    }
    case 'openrouter': {
      const key = keys.openrouter;
      if (!key) throw new Error('Kein OpenRouter API-Key gesetzt.');
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: bubble.model || 'anthropic/claude-3.5-sonnet', temperature: temp, messages: [{ role: 'system', content: sys }, ...messages] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `OpenRouter HTTP ${res.status}`);
      return { text: data.choices?.[0]?.message?.content || '', citations: [] };
    }
    default:
      throw new Error(`Unbekannte Engine: ${bubble.engine}`);
  }
}

// ── IPC ─────────────────────────────────────────────────────

function registerBubbleHandlers(theStore) {
  store = theStore;
  ensureDefaults();

  ipcMain.handle('bubbles-state', () => ({
    bubbles: store.get('bubbles', []),
    groups:  store.get('bubbleGroups', []),
    visible,
  }));

  ipcMain.handle('bubble-save', (_, bubble) => {
    const bubbles = store.get('bubbles', []);
    const i = bubbles.findIndex(b => b.id === bubble.id);
    if (i >= 0) bubbles[i] = { ...bubbles[i], ...bubble };
    else {
      bubble.id = bubble.id || `b-${Date.now()}`;
      bubbles.push(bubble);
      // neue Bubble in erste Gruppe aufnehmen, falls nirgends enthalten
      const groups = store.get('bubbleGroups', []);
      if (groups.length && !groups.some(g => g.bubbleIds.includes(bubble.id))) {
        groups[0].bubbleIds.push(bubble.id);
        store.set('bubbleGroups', groups);
      }
    }
    store.set('bubbles', bubbles);
    syncWindows();
    broadcast();
    return bubbles;
  });

  ipcMain.handle('bubble-delete', (_, id) => {
    store.set('bubbles', store.get('bubbles', []).filter(b => b.id !== id));
    const groups = store.get('bubbleGroups', []);
    groups.forEach(g => { g.bubbleIds = g.bubbleIds.filter(bid => bid !== id); });
    store.set('bubbleGroups', groups);
    syncWindows();
    broadcast();
    return true;
  });

  ipcMain.handle('bubble-group-save', (_, group) => {
    const groups = store.get('bubbleGroups', []);
    const i = groups.findIndex(g => g.id === group.id);
    if (i >= 0) groups[i] = { ...groups[i], ...group };
    else groups.push({ id: `g-${Date.now()}`, name: 'Neue Gruppe', edge: 'float', x: null, y: null, bubbleIds: [], ...group });
    store.set('bubbleGroups', groups);
    syncWindows();
    broadcast();
    return groups;
  });

  ipcMain.handle('bubble-group-delete', (_, id) => {
    store.set('bubbleGroups', store.get('bubbleGroups', []).filter(g => g.id !== id));
    syncWindows();
    broadcast();
    return true;
  });

  ipcMain.handle('bubble-run', async (_, { bubbleId, messages }) => {
    const bubble = store.get('bubbles', []).find(b => b.id === bubbleId);
    if (!bubble) return { ok: false, error: 'Bubble nicht gefunden' };
    try {
      const out = await runEngine(bubble, messages);
      return { ok: true, ...out };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Fenstergröße bei Auf-/Zuklappen des Chat-Panels anpassen
  ipcMain.on('bubblebar-expand', (ev, expanded) => {
    const win = BrowserWindow.fromWebContents(ev.sender);
    if (!win) return;
    const groupId = [...groupWins.entries()].find(([, w]) => w === win)?.[0];
    const group   = store.get('bubbleGroups', []).find(g => g.id === groupId);
    if (!group) return;
    const cur = win.getBounds();
    const b   = barBounds({ ...group, y: cur.y, x: group.edge === 'float' ? cur.x : null }, expanded);
    // beim Rechts-Dock nach links aufklappen
    win.setBounds(b);
  });

  ipcMain.handle('bubbles-toggle', (_, show) => toggleBars(show));
}

function broadcast() {
  for (const win of groupWins.values()) win.webContents.send('bubbles-changed');
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('bubbles-changed');
}

function createBubbleBars() { syncWindows(); }

module.exports = { registerBubbleHandlers, createBubbleBars, toggleBars };
