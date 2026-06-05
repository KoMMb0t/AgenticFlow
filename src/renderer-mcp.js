// ── MCP Manager (Logik) — CSP-konform, window.api ────────
// UI-Rendering passiert in renderer-taskbar.js (drittes Dropdown).
// Diese Klasse hält nur State + Aktionen.

// Verfügbare MCP-Server-Templates (Ordner unter /MCP)
window.MCP_TEMPLATES = [
  { id: 'perplexity', name: 'Perplexity', icon: '◎', port: 3010, desc: 'Web-Suche & Recherche' },
  { id: 'github',     name: 'GitHub',     icon: '⚡', port: 3011, desc: 'Repos, Issues, PRs' },
  { id: 'notion',     name: 'Notion',     icon: 'N',  port: 3012, desc: 'Seiten & Datenbanken' },
  { id: 'slack',      name: 'Slack',      icon: 'S',  port: 3013, desc: 'Channels & Nachrichten' },
];

class MCPManager {
  constructor() {
    this.activeMcps  = this._load('af_mcps',         []);   // [{id,name,icon,url,connected}]
    this.contextMcps = this._load('af_mcp_context',  []);   // [mcpId] — im Chat-Kontext aktiv
  }

  _load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
  }
  _save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  getTemplates()  { return window.MCP_TEMPLATES; }
  getActive()     { return this.activeMcps; }
  isActive(id)    { return this.activeMcps.some(m => m.id === id); }
  isInContext(id) { return this.contextMcps.includes(id); }

  // MCP aus Template aktivieren (Server starten)
  async activateTemplate(tplId) {
    const tpl = window.MCP_TEMPLATES.find(t => t.id === tplId);
    if (!tpl || this.isActive(tplId)) return;
    const url = `http://localhost:${tpl.port}`;
    this.activeMcps.push({ id: tpl.id, name: tpl.name, icon: tpl.icon, url, connected: false });
    this._save('af_mcps', this.activeMcps);
    // Server im Main-Process starten
    await window.api.launchMcpServer?.({ id: tpl.id, name: tpl.name, port: tpl.port }).catch(() => {});
    this.checkHealth();
  }

  // Custom MCP (eigene URL)
  addCustom(id, name, url) {
    if (this.isActive(id)) return;
    this.activeMcps.push({ id, name, icon: '🔌', url, connected: false });
    this._save('af_mcps', this.activeMcps);
    this.checkHealth();
  }

  removeMcp(id) {
    this.activeMcps  = this.activeMcps.filter(m => m.id !== id);
    this.contextMcps = this.contextMcps.filter(c => c !== id);
    this._save('af_mcps', this.activeMcps);
    this._save('af_mcp_context', this.contextMcps);
  }

  // Im Chat-Kontext an/aus (Multiauswahl)
  toggleContext(id) {
    if (this.contextMcps.includes(id)) {
      this.contextMcps = this.contextMcps.filter(c => c !== id);
    } else {
      this.contextMcps.push(id);
    }
    this._save('af_mcp_context', this.contextMcps);
  }

  // Health-Check aller aktiven MCPs
  async checkHealth() {
    await Promise.all(this.activeMcps.map(async m => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(`${m.url}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        m.connected = res.ok;
      } catch { m.connected = false; }
    }));
    this._save('af_mcps', this.activeMcps);
    window.dispatchEvent(new Event('mcp-status-changed'));
  }
}

window.mcpMgr = new MCPManager();
