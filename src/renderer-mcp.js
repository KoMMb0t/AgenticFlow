/**
 * AgenticFlow MCP Manager — UI-Integration
 * Verwaltet MCP-Verbindungen und Taskbar-Dropdown
 */

class MCPManager {
  constructor(store, ipcRenderer) {
    this.store = store;
    this.ipc = ipcRenderer;
    this.activeMcps = store.get('activeMcps') || [];
    this.selectedContextMcps = store.get('selectedContextMcps') || {};
  }

  // ── MCP hinzufügen ────────────────────────────────
  addMCP(mcpId, mcpName, mcpURL) {
    const existing = this.activeMcps.find(m => m.id === mcpId);
    if (existing) return; // Duplikat vermeiden

    this.activeMcps.push({
      id: mcpId,
      name: mcpName,
      url: mcpURL,
      connected: false,
      lastPing: null,
      tools: [],
    });

    this.store.set('activeMcps', this.activeMcps);
    this.renderDropdown();
    this.checkConnections();
  }

  // ── MCP entfernen ────────────────────────────────
  removeMCP(mcpId) {
    this.activeMcps = this.activeMcps.filter(m => m.id !== mcpId);
    this.store.set('activeMcps', this.activeMcps);
    this.renderDropdown();
  }

  // ── MCP-Gesundheit prüfen ────────────────────────
  async checkConnections() {
    for (const mcp of this.activeMcps) {
      try {
        const response = await fetch(`${mcp.url}/health`, { timeout: 5000 });
        mcp.connected = response.ok;
        mcp.lastPing = new Date().toISOString();
      } catch (err) {
        mcp.connected = false;
        mcp.lastPing = null;
      }
    }
    this.store.set('activeMcps', this.activeMcps);
    this.updateStatusIndicators();
  }

  // ── Taskbar Dropdown rendern ──────────────────────
  renderDropdown() {
    const dropdown = document.getElementById('mcp-dropdown-menu');
    if (!dropdown) return;

    dropdown.innerHTML = `
      <div class="mcp-dropdown-header">
        📡 MCP-Verbindungen (${this.activeMcps.length})
      </div>

      <div class="mcp-list">
        ${this.activeMcps.map(mcp => `
          <div class="mcp-item ${mcp.connected ? 'connected' : 'disconnected'}">
            <span class="mcp-status">${mcp.connected ? '✅' : '⚠️'}</span>
            <span class="mcp-name">${mcp.name}</span>
            <button class="mcp-remove" onclick="window.mcpManager.removeMCP('${mcp.id}')">×</button>
          </div>
        `).join('')}
      </div>

      <div class="mcp-actions">
        <button id="btn-add-mcp" class="btn-primary">+ Neue MCP hinzufügen</button>
      </div>

      <div class="mcp-templates">
        <div class="template-label">Verfügbare Templates:</div>
        ${[
          { id: 'perplexity', name: '◎ Perplexity', status: 'ready' },
          { id: 'github', name: '⚡ GitHub', status: 'ready' },
          { id: 'notion', name: 'N Notion', status: 'ready' },
          { id: 'slack', name: 'S Slack', status: 'ready' },
        ].map(tpl => `
          <button class="template-btn" data-template="${tpl.id}">
            ${tpl.name}
          </button>
        `).join('')}
      </div>
    `;

    this.attachEventListeners();
  }

  // ── Event-Listener für Dropdown ───────────────────
  attachEventListeners() {
    const templateBtns = document.querySelectorAll('.template-btn');
    templateBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const template = e.target.dataset.template;
        await this.launchMCPServer(template);
      });
    });

    const addBtn = document.getElementById('btn-add-mcp');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddMCPDialog());
    }
  }

  // ── MCP-Server starten (lokal) ───────────────────
  async launchMCPServer(template) {
    const templates = {
      perplexity: {
        name: 'Perplexity',
        path: 'C:\\Users\\ModBot\\AgenticFlow\\MCP\\Perplexity',
        command: 'npm start',
      },
      github: {
        name: 'GitHub',
        path: 'C:\\Users\\ModBot\\AgenticFlow\\MCP\\GitHub',
        command: 'npm start',
      },
      notion: {
        name: 'Notion',
        path: 'C:\\Users\\ModBot\\AgenticFlow\\MCP\\Notion',
        command: 'npm start',
      },
      slack: {
        name: 'Slack',
        path: 'C:\\Users\\ModBot\\AgenticFlow\\MCP\\Slack',
        command: 'npm start',
      },
    };

    const tpl = templates[template];
    if (!tpl) return;

    // IPC zu Main-Process senden
    this.ipc.send('launch-mcp-server', {
      template,
      name: tpl.name,
      path: tpl.path,
      command: tpl.command,
    });
  }

  // ── Dialog: MCP Custom hinzufügen ────────────────
  showAddMCPDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog mcp-add-dialog';
    dialog.innerHTML = `
      <div class="modal-content">
        <h3>Neue MCP-Verbindung hinzufügen</h3>
        <form id="form-add-mcp">
          <input type="text" id="mcp-id" placeholder="MCP ID (z.B. my-custom-mcp)" required>
          <input type="text" id="mcp-name" placeholder="Name (z.B. My Custom Service)" required>
          <input type="text" id="mcp-url" placeholder="URL (z.B. http://localhost:3002)" required>
          <div class="modal-buttons">
            <button type="submit" class="btn-primary">Hinzufügen</button>
            <button type="button" class="btn-secondary" onclick="this.closest('.modal-dialog').remove()">Abbrechen</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('form-add-mcp').addEventListener('submit', (e) => {
      e.preventDefault();
      const mcpId = document.getElementById('mcp-id').value;
      const mcpName = document.getElementById('mcp-name').value;
      const mcpURL = document.getElementById('mcp-url').value;

      this.addMCP(mcpId, mcpName, mcpURL);
      dialog.remove();
    });
  }

  // ── Status-Indikatoren updaten ───────────────────
  updateStatusIndicators() {
    const items = document.querySelectorAll('.mcp-item');
    items.forEach((item, i) => {
      const mcp = this.activeMcps[i];
      item.className = `mcp-item ${mcp.connected ? 'connected' : 'disconnected'}`;
      item.querySelector('.mcp-status').textContent = mcp.connected ? '✅' : '⚠️';
    });
  }

  // ── Kontext-MCPs für Chat/Agent-Session ─────────
  setContextMCPs(contextId, mcpIds) {
    this.selectedContextMcps[contextId] = mcpIds;
    this.store.set('selectedContextMcps', this.selectedContextMcps);
  }

  getContextMCPs(contextId) {
    return this.selectedContextMcps[contextId] || [];
  }

  // ── Kontext-Dropdown rendern (in Chat-Fenster) ──
  renderContextMCPSelector(contextId) {
    const selectedMcps = this.getContextMCPs(contextId);

    return `
      <div class="context-mcp-selector">
        <label>📡 MCP-Kontext:</label>
        <div class="mcp-checkboxes">
          ${this.activeMcps.map(mcp => `
            <label class="checkbox-mcp">
              <input
                type="checkbox"
                value="${mcp.id}"
                ${selectedMcps.includes(mcp.id) ? 'checked' : ''}
                onchange="window.mcpManager.toggleContextMCP('${contextId}', '${mcp.id}')"
              >
              ${mcp.connected ? '✅' : '⚠️'} ${mcp.name}
            </label>
          `).join('')}
        </div>
        <button class="btn-small" onclick="document.getElementById('mcp-custom-${contextId}').style.display='block'">
          + Custom MCP
        </button>
      </div>
    `;
  }

  // ── Toggle MCP für Kontext ──────────────────────
  toggleContextMCP(contextId, mcpId) {
    let selected = this.getContextMCPs(contextId);
    if (selected.includes(mcpId)) {
      selected = selected.filter(m => m !== mcpId);
    } else {
      selected.push(mcpId);
    }
    this.setContextMCPs(contextId, selected);
  }
}

// ── Modul exportieren ────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MCPManager;
}
