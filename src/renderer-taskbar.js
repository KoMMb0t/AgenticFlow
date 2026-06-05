// ── Taskbar: Rollen-Dropdown + Agenten-Dropdown ──────────

// Alle verfügbaren Rollen (Multiauswahl möglich)
window.ROLES = [
  { id: 'architect',     icon: '🏗', name: 'Architect',       desc: 'Analysiert & koordiniert' },
  { id: 'researcher',    icon: '🔍', name: 'Researcher',      desc: 'Recherche & Fakten' },
  { id: 'coder',         icon: '💻', name: 'Coder',           desc: 'Code & Technik' },
  { id: 'writer',        icon: '✍',  name: 'Writer',          desc: 'Texte & Inhalte' },
  { id: 'analyst',       icon: '📊', name: 'Analyst',         desc: 'Daten & Auswertung' },
  { id: 'documentation', icon: '📄', name: 'Dokumentation',   desc: 'Doku & Anleitungen' },
  { id: 'visualization', icon: '📈', name: 'Visualisierung',  desc: 'Diagramme & Charts' },
  { id: 'concept',       icon: '💡', name: 'Konzepterstellung', desc: 'Ideen & Konzepte' },
  { id: 'planning',      icon: '📋', name: 'Planung',         desc: 'Roadmaps & Schritte' },
];

// Erweiterte Prompts für alle Rollen
window.ROLE_PROMPTS = {
  architect:     'Du bist der Architect-Agent. Analysiere Aufgaben, zerlege sie und koordiniere. Format zum Delegieren: [DELEGATE:rolle:aufgabe]. Deutsch.',
  researcher:    'Du bist Researcher. Recherchiere gründlich, strukturiert, quellenbasiert. Deutsch.',
  coder:         'Du bist Coding-Agent. Schreibe, analysiere, verbessere Code. Erkläre kurz. Markdown-Codeblöcke.',
  writer:        'Du bist Writer. Formuliere Texte klar, präzise, ansprechend.',
  analyst:       'Du bist Analyst. Analysiere Daten, Trends, Muster mit klaren Schlussfolgerungen.',
  documentation: 'Du bist Dokumentations-Agent. Erstelle klare, strukturierte Dokumentation, READMEs, Anleitungen mit Beispielen.',
  visualization: 'Du bist Visualisierungs-Agent. Erstelle Diagramme (Mermaid, ASCII), Charts und visuelle Darstellungen. Beschreibe Strukturen visuell.',
  concept:       'Du bist Konzept-Agent. Entwickle kreative Konzepte, Ideen und Lösungsansätze. Denke out-of-the-box.',
  planning:      'Du bist Planungs-Agent. Erstelle Roadmaps, Zeitpläne, Schritt-für-Schritt-Pläne mit Meilensteinen.',
};

// Agenten/Modelle die direkt anwählbar sind
window.AGENT_MODELS = [
  { id: 'claude-opus-4-8',           icon: '🏗', name: 'Claude Opus 4.8',  type: 'api', desc: 'Tiefste Analyse' },
  { id: 'claude-sonnet-4-6',         icon: '⚗',  name: 'Claude Sonnet 4.6', type: 'api', desc: 'Empfohlen' },
  { id: 'claude-haiku-4-5-20251001', icon: '⚡', name: 'Claude Haiku 4.5',  type: 'api', desc: 'Schnell' },
];

class TaskbarManager {
  constructor() {
    this.state = null;
    this.selectedRoles = ['architect'];  // Multiauswahl
    this.autoMode = false;               // Agent wählt selbst
    this.activeModel = 'claude-sonnet-4-6';
  }

  init(state) {
    this.state = state;
    this._injectCSS();
    this._render();
    this._wireGlobalClose();
  }

  _injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #agent-bar { position: relative; }
      .taskbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
      .tb-dropdown { position: relative; }
      .tb-btn {
        height: 34px; padding: 0 12px;
        background: var(--bg-card); border: 1px solid var(--bd2);
        border-radius: 8px; color: var(--txt); font-size: 12px;
        cursor: pointer; display: flex; align-items: center; gap: 7px;
        transition: all .12s; white-space: nowrap;
      }
      .tb-btn:hover { background: var(--bg-h); border-color: var(--acc-dim); }
      .tb-btn.active { border-color: var(--acc); background: var(--acc-dim); }
      .tb-btn-icon { font-size: 15px; }
      .tb-arrow { font-size: 9px; color: var(--txt-d); margin-left: 2px; }
      .tb-count {
        background: var(--acc); color: #fff; font-size: 9px; font-weight: 700;
        border-radius: 10px; padding: 1px 6px; margin-left: 2px;
      }

      .tb-menu {
        position: absolute; top: calc(100% + 6px); left: 0; z-index: 300;
        min-width: 260px;
        background: var(--bg-p); border: 1px solid var(--bd2);
        border-radius: 10px; box-shadow: 0 10px 36px rgba(0,0,0,.55);
        padding: 6px; display: none;
      }
      .tb-menu.open { display: block; animation: tbDrop .18s cubic-bezier(.4,0,.2,1); transform-origin: top; }
      @keyframes tbDrop { from { opacity: 0; transform: scaleY(.85) translateY(-4px); } to { opacity: 1; transform: scaleY(1) translateY(0); } }

      .tb-menu-head {
        font-size: 9.5px; font-weight: 700; color: var(--txt-d);
        text-transform: uppercase; letter-spacing: .06em;
        padding: 8px 10px 5px;
      }

      .tb-opt {
        display: flex; align-items: center; gap: 10px; padding: 8px 10px;
        border-radius: 7px; cursor: pointer; transition: background .1s;
      }
      .tb-opt:hover { background: var(--bg-h); }
      .tb-opt.selected { background: var(--acc-dim); }
      .tb-opt-check {
        width: 16px; height: 16px; flex-shrink: 0;
        border: 1.5px solid var(--bd2); border-radius: 5px;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; color: #fff;
      }
      .tb-opt.selected .tb-opt-check { background: var(--acc); border-color: var(--acc); }
      .tb-opt-icon { font-size: 16px; flex-shrink: 0; }
      .tb-opt-body { flex: 1; min-width: 0; }
      .tb-opt-name { font-size: 12px; font-weight: 600; color: var(--txt); }
      .tb-opt-desc { font-size: 10px; color: var(--txt-d); }

      .tb-auto {
        margin: 4px 0; padding: 10px;
        background: linear-gradient(135deg, var(--acc-dim), transparent);
        border: 1px solid var(--acc-dim); border-radius: 8px;
        display: flex; align-items: center; gap: 10px; cursor: pointer;
      }
      .tb-auto:hover { border-color: var(--acc); }
      .tb-auto.on { background: var(--acc); border-color: var(--acc); }
      .tb-auto.on .tb-opt-name, .tb-auto.on .tb-opt-desc { color: #fff; }
      .tb-divider { height: 1px; background: var(--bd); margin: 6px 4px; }

      .tb-radio {
        width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%;
        border: 1.5px solid var(--bd2);
        display: flex; align-items: center; justify-content: center;
      }
      .tb-opt.selected .tb-radio { border-color: var(--acc); }
      .tb-opt.selected .tb-radio::after {
        content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--acc);
      }

      .mcp-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 3px; }
      .mcp-dot.on  { background: var(--success); }
      .mcp-dot.off { background: var(--txt-d); }
      .tb-mcp-x {
        width: 18px; height: 18px; flex-shrink: 0;
        background: transparent; border: none; color: var(--txt-d);
        border-radius: 4px; cursor: pointer; font-size: 10px;
        display: flex; align-items: center; justify-content: center;
      }
      .tb-mcp-x:hover { background: var(--danger); color: #fff; }
    `;
    document.head.appendChild(s);
  }

  _render() {
    const bar = $('agent-bar');
    if (!bar) return;
    bar.innerHTML = `
      <div class="taskbar">
        <!-- Rolle -->
        <div class="tb-dropdown">
          <button class="tb-btn" id="tb-roles-btn">
            <span class="tb-btn-icon">🎭</span>
            <span id="tb-roles-label">Rolle · Architect</span>
            <span class="tb-arrow">▾</span>
          </button>
          <div class="tb-menu" id="tb-roles-menu"></div>
        </div>
        <!-- KI -->
        <div class="tb-dropdown">
          <button class="tb-btn" id="tb-agents-btn">
            <span class="tb-btn-icon">🤖</span>
            <span id="tb-agents-label">KI · Sonnet 4.6</span>
            <span class="tb-arrow">▾</span>
          </button>
          <div class="tb-menu" id="tb-agents-menu"></div>
        </div>
        <!-- MCP -->
        <div class="tb-dropdown">
          <button class="tb-btn" id="tb-mcp-btn">
            <span class="tb-btn-icon">📡</span>
            <span id="tb-mcp-label">MCP</span>
            <span class="tb-arrow">▾</span>
          </button>
          <div class="tb-menu" id="tb-mcp-menu"></div>
        </div>
      </div>
    `;

    this._renderRolesMenu();
    this._renderAgentsMenu();
    this._renderMcpMenu();

    $('tb-roles-btn').addEventListener('click', e => {
      e.stopPropagation();
      this._toggleMenu('tb-roles-menu');
    });
    $('tb-agents-btn').addEventListener('click', e => {
      e.stopPropagation();
      this._toggleMenu('tb-agents-menu');
    });
    $('tb-mcp-btn').addEventListener('click', e => {
      e.stopPropagation();
      this._toggleMenu('tb-mcp-menu');
    });

    // MCP-Status live aktualisieren
    window.addEventListener('mcp-status-changed', () => { this._renderMcpMenu(); this._updateMcpLabel(); });

    this._updateRolesLabel();
    this._updateMcpLabel();
  }

  _renderMcpMenu() {
    const menu = $('tb-mcp-menu');
    if (!menu || !window.mcpMgr) return;
    const active = window.mcpMgr.getActive();

    let html = '';

    // Aktive MCPs mit Kontext-Checkbox (Multiauswahl, wie Rollen)
    if (active.length) {
      html += `<div class="tb-menu-head">Aktiv — im Chat-Kontext nutzen</div>`;
      active.forEach(m => {
        const inCtx = window.mcpMgr.isInContext(m.id);
        html += `
          <div class="tb-opt ${inCtx ? 'selected' : ''}" data-ctx="${m.id}">
            <span class="tb-opt-check">${inCtx ? '✓' : ''}</span>
            <span class="tb-opt-icon">${m.icon}</span>
            <div class="tb-opt-body">
              <div class="tb-opt-name">${esc(m.name)}</div>
              <div class="tb-opt-desc">
                <span class="mcp-dot ${m.connected ? 'on' : 'off'}"></span>
                ${m.connected ? 'verbunden' : 'offline'} · ${esc(m.url)}
              </div>
            </div>
            <button class="tb-mcp-x" data-remove="${m.id}" title="Entfernen">✕</button>
          </div>`;
      });
      html += `<div class="tb-divider"></div>`;
    }

    // Templates zum Aktivieren
    html += `<div class="tb-menu-head">MCP-Server starten</div>`;
    window.mcpMgr.getTemplates().forEach(t => {
      const isOn = window.mcpMgr.isActive(t.id);
      html += `
        <div class="tb-opt ${isOn ? 'disabled' : ''}" data-tpl="${t.id}" style="${isOn ? 'opacity:.4' : ''}">
          <span class="tb-opt-icon">${t.icon}</span>
          <div class="tb-opt-body">
            <div class="tb-opt-name">${esc(t.name)} ${isOn ? '✓' : ''}</div>
            <div class="tb-opt-desc">${esc(t.desc)} · Port ${t.port}</div>
          </div>
          ${isOn ? '' : '<span style="font-size:11px;color:var(--acc)">▶ Start</span>'}
        </div>`;
    });

    // Custom + Refresh
    html += `<div class="tb-divider"></div>
      <div class="tb-opt" id="tb-mcp-custom">
        <span class="tb-opt-icon">🔌</span>
        <div class="tb-opt-body"><div class="tb-opt-name">Custom MCP…</div>
        <div class="tb-opt-desc">Eigene URL verbinden</div></div>
      </div>
      <div class="tb-opt" id="tb-mcp-refresh">
        <span class="tb-opt-icon">↻</span>
        <div class="tb-opt-body"><div class="tb-opt-name">Status prüfen</div></div>
      </div>`;

    menu.innerHTML = html;

    // Kontext-Toggle
    menu.querySelectorAll('[data-ctx]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-remove]')) return;
        window.mcpMgr.toggleContext(el.dataset.ctx);
        this._renderMcpMenu();
        this._updateMcpLabel();
      });
    });
    // Entfernen
    menu.querySelectorAll('[data-remove]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        window.mcpMgr.removeMcp(el.dataset.remove);
        this._renderMcpMenu();
        this._updateMcpLabel();
      });
    });
    // Template starten
    menu.querySelectorAll('[data-tpl]').forEach(el => {
      if (el.classList.contains('disabled')) return;
      el.addEventListener('click', async () => {
        await window.mcpMgr.activateTemplate(el.dataset.tpl);
        this._renderMcpMenu();
        this._updateMcpLabel();
      });
    });
    // Custom
    $('tb-mcp-custom')?.addEventListener('click', () => {
      const id   = prompt('MCP-ID (z.B. my-mcp):'); if (!id) return;
      const name = prompt('Name:') || id;
      const url  = prompt('URL (z.B. http://localhost:3099):'); if (!url) return;
      window.mcpMgr.addCustom(id, name, url);
      this._renderMcpMenu(); this._updateMcpLabel();
    });
    // Refresh
    $('tb-mcp-refresh')?.addEventListener('click', () => window.mcpMgr.checkHealth());
  }

  _updateMcpLabel() {
    const label = $('tb-mcp-label');
    if (!label || !window.mcpMgr) return;
    const ctx = window.mcpMgr.contextMcps.length;
    label.innerHTML = ctx ? `MCP · ${ctx} aktiv <span class="tb-count">${ctx}</span>` : 'MCP';
    $('tb-mcp-btn')?.classList.toggle('active', ctx > 0);
  }

  _renderRolesMenu() {
    const menu = $('tb-roles-menu');
    if (!menu) return;
    menu.innerHTML = `
      <div class="tb-auto ${this.autoMode ? 'on' : ''}" id="tb-auto">
        <span class="tb-opt-icon">⚡</span>
        <div class="tb-opt-body">
          <div class="tb-opt-name">Automatik</div>
          <div class="tb-opt-desc">Agent wählt selbst passende Rollen</div>
        </div>
        <span class="tb-opt-check">${this.autoMode ? '✓' : ''}</span>
      </div>
      <div class="tb-divider"></div>
      <div class="tb-menu-head">Rollen (Mehrfachauswahl)</div>
    `;

    window.ROLES.forEach(role => {
      const selected = this.selectedRoles.includes(role.id);
      const opt = document.createElement('div');
      opt.className = `tb-opt ${selected ? 'selected' : ''} ${this.autoMode ? 'disabled' : ''}`;
      opt.style.opacity = this.autoMode ? '.4' : '1';
      opt.innerHTML = `
        <span class="tb-opt-check">${selected ? '✓' : ''}</span>
        <span class="tb-opt-icon">${role.icon}</span>
        <div class="tb-opt-body">
          <div class="tb-opt-name">${role.name}</div>
          <div class="tb-opt-desc">${role.desc}</div>
        </div>
      `;
      opt.addEventListener('click', () => {
        if (this.autoMode) return;
        this._toggleRole(role.id);
      });
      menu.appendChild(opt);
    });

    $('tb-auto')?.addEventListener('click', () => this._toggleAuto());
  }

  _renderAgentsMenu() {
    const menu = $('tb-agents-menu');
    if (!menu) return;
    menu.innerHTML = `<div class="tb-menu-head">Claude API Modelle</div>`;

    window.AGENT_MODELS.forEach(m => {
      const selected = this.activeModel === m.id;
      const opt = document.createElement('div');
      opt.className = `tb-opt ${selected ? 'selected' : ''}`;
      opt.innerHTML = `
        <span class="tb-radio"></span>
        <span class="tb-opt-icon">${m.icon}</span>
        <div class="tb-opt-body">
          <div class="tb-opt-name">${m.name}</div>
          <div class="tb-opt-desc">${m.desc}</div>
        </div>
      `;
      opt.addEventListener('click', () => {
        this.activeModel = m.id;
        const sel = $('architect-model');
        if (sel) sel.value = m.id;
        this._renderAgentsMenu();
        this._updateAgentsLabel();
        this._closeAllMenus();
      });
      menu.appendChild(opt);
    });

    // Verbundene KI-Agenten (Browser)
    const aiAccounts = accountMgr.getByCategory('ai');
    if (aiAccounts.length) {
      const head = document.createElement('div');
      head.className = 'tb-menu-head';
      head.textContent = 'Verbundene KI (Browser)';
      menu.appendChild(head);

      aiAccounts.forEach(acc => {
        const opt = document.createElement('div');
        opt.className = 'tb-opt';
        opt.innerHTML = `
          <span class="tb-opt-icon">${acc.icon}</span>
          <div class="tb-opt-body">
            <div class="tb-opt-name">${esc(acc.name)}</div>
            <div class="tb-opt-desc">${esc(acc.label || 'Browser')} → öffnen</div>
          </div>
          <span style="font-size:11px;color:var(--txt-d)">↗</span>
        `;
        opt.addEventListener('click', () => {
          sidebar.toggleApp(acc);
          this._closeAllMenus();
        });
        menu.appendChild(opt);
      });
    }
  }

  _toggleRole(id) {
    const idx = this.selectedRoles.indexOf(id);
    if (idx >= 0) {
      if (this.selectedRoles.length > 1) this.selectedRoles.splice(idx, 1);
    } else {
      this.selectedRoles.push(id);
    }
    this._renderRolesMenu();
    this._updateRolesLabel();
  }

  _toggleAuto() {
    this.autoMode = !this.autoMode;
    this._renderRolesMenu();
    this._updateRolesLabel();
  }

  _updateRolesLabel() {
    const label = $('tb-roles-label');
    if (!label) return;
    if (this.autoMode) {
      label.innerHTML = 'Rolle · ⚡ Auto';
    } else if (this.selectedRoles.length === 1) {
      const r = window.ROLES.find(x => x.id === this.selectedRoles[0]);
      label.textContent = 'Rolle · ' + (r?.name || 'Architect');
    } else {
      label.innerHTML = `Rolle · ${this.selectedRoles.length} gewählt <span class="tb-count">${this.selectedRoles.length}</span>`;
    }
    $('tb-roles-btn')?.classList.toggle('active', this.autoMode || this.selectedRoles.length > 1);
  }

  _updateAgentsLabel() {
    const label = $('tb-agents-label');
    const m = window.AGENT_MODELS.find(x => x.id === this.activeModel);
    if (label && m) label.textContent = 'KI · ' + m.name.replace('Claude ', '');
  }

  _toggleMenu(id) {
    const menu = $(id);
    const isOpen = menu.classList.contains('open');
    this._closeAllMenus();
    if (!isOpen) menu.classList.add('open');
  }

  _closeAllMenus() {
    document.querySelectorAll('.tb-menu').forEach(m => m.classList.remove('open'));
  }

  _wireGlobalClose() {
    document.addEventListener('click', e => {
      if (!e.target.closest('.tb-dropdown')) this._closeAllMenus();
    });
  }

  // Wird vom Center beim Senden abgefragt
  getActiveConfig() {
    return {
      roles:    this.autoMode ? 'auto' : this.selectedRoles,
      autoMode: this.autoMode,
      model:    this.activeModel,
    };
  }

  // Baut System-Prompt aus gewählten Rollen
  buildSystemPrompt() {
    if (this.autoMode) {
      return 'Du bist ein adaptiver Multi-Rollen-Agent. Wähle selbstständig die passende(n) Rolle(n) für die Aufgabe: Architect, Researcher, Coder, Writer, Analyst, Dokumentation, Visualisierung, Konzept, Planung. Nenne kurz welche Rolle(n) du nutzt. Antworte auf Deutsch.';
    }
    if (this.selectedRoles.length === 1) {
      return window.ROLE_PROMPTS[this.selectedRoles[0]] || window.ROLE_PROMPTS.architect;
    }
    // Mehrere Rollen kombinieren
    const combined = this.selectedRoles.map(r => {
      const role = window.ROLES.find(x => x.id === r);
      return `${role.icon} ${role.name}: ${window.ROLE_PROMPTS[r]}`;
    }).join('\n\n');
    return `Du arbeitest in mehreren Rollen gleichzeitig. Kombiniere diese Perspektiven:\n\n${combined}\n\nAntworte ganzheitlich auf Deutsch.`;
  }
}

window.taskbarMgr = new TaskbarManager();
