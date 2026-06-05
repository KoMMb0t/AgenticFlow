// ── Center Panel: Projects + Chat + Agents ────────────────

class CenterManager {
  constructor() {
    this.state        = null;
    this.activeAgent  = 'architect';
    this.isStreaming  = false;
    this.recognition  = null;
    this.micActive    = false;
    this.voiceActive  = false;
  }

  init(state) {
    this.state = state;
    this.setupProjectButtons();
    this.setupAgentTabs();
    this.setupChatInput();
    this.setupMicVoice();
    this.setupAppToggle();
    this.renderProjects();
  }

  // ── PROJECTS ──────────────────────────────────────────────

  renderProjects() {
    const grid    = $('project-grid');
    const welcome = $('home-welcome');
    if (!grid) return;

    const projects = this.state.projects || [];
    grid.innerHTML = '';

    if (!projects.length) {
      if (welcome) welcome.style.display = 'flex';
      return;
    }
    if (welcome) welcome.style.display = 'none';

    [...projects]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .forEach(p => grid.appendChild(this.makeCard(p)));
  }

  makeCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="pc-icon">🏗</div>
      <div class="pc-body">
        <div class="pc-name">${esc(p.name)}</div>
        <div class="pc-meta">${(p.model || '').split('-').slice(1,3).join(' ') || 'Sonnet'} · ${relDate(p.updatedAt || p.createdAt)}</div>
        ${p.description ? `<div class="pc-desc">${esc(p.description)}</div>` : ''}
      </div>
      <button class="pc-del" title="Löschen">✕</button>
    `;
    card.querySelector('.pc-del').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`"${p.name}" löschen?`)) {
        this.state.projects = this.state.projects.filter(x => x.id !== p.id);
        window.api.projectDelete?.(p.id);
        this.renderProjects();
      }
    });
    card.addEventListener('click', () => this.openProject(p));
    return card;
  }

  setupProjectButtons() {
    $('btn-new-project')?.addEventListener('click',   () => this.newProject());
    $('btn-new-project-2')?.addEventListener('click', () => this.newProject());
    $('btn-back-home')?.addEventListener('click',     () => this.showHome());
  }

  showHome() {
    $('view-home').style.display    = 'flex';
    $('view-project').style.display = 'none';
    this.state.activeProjectId = null;
    this.renderProjects();
  }

  openProject(p) {
    this.state.activeProjectId = p.id;
    window.api.setActiveProject?.(p.id);
    $('view-home').style.display    = 'none';
    $('view-project').style.display = 'flex';
    $('proj-title').textContent = p.name;
    const sel = $('architect-model');
    if (sel && p.model) sel.value = p.model;
    this.state.chatMessages = p.messages || [];
    this.renderMessages();
  }

  newProject() {
    const name = prompt('Projektname:');
    if (!name?.trim()) return;
    const p = {
      id: genId(), name: name.trim(),
      model: $('architect-model')?.value || 'claude-sonnet-4-6',
      messages: [], description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.projects.push(p);
    window.api.projectCreate?.(p);
    this.openProject(p);
  }

  // ── AGENT TABS ────────────────────────────────────────────

  setupAgentTabs() {
    document.querySelectorAll('.agent-tab').forEach(tab => {
      tab.addEventListener('click', () => this.setAgent(tab.dataset.agent));
    });
    $('architect-model')?.addEventListener('change', e => {
      const p = this.state.projects.find(x => x.id === this.state.activeProjectId);
      if (p) {
        p.model = e.target.value;
        window.api.projectUpdate?.(p.id, { model: e.target.value });
      }
    });

    // Provider-Umschalter: Modell-Liste passend zum Anbieter
    const PROVIDER_MODELS = {
      claude: [
        ['claude-opus-4-8',           '🏗 Opus 4.8'],
        ['claude-sonnet-4-6',         '⚗ Sonnet 4.6'],
        ['claude-haiku-4-5-20251001', '⚡ Haiku 4.5'],
      ],
      openai: [
        ['gpt-4o',      '🤖 GPT-4o'],
        ['gpt-4o-mini', '🤖 GPT-4o mini'],
      ],
      gemini: [
        ['gemini-1.5-pro',   '✦ Gemini 1.5 Pro'],
        ['gemini-1.5-flash', '✦ Gemini 1.5 Flash'],
      ],
    };
    $('provider-select')?.addEventListener('change', e => {
      const p = e.target.value;
      const sel = $('architect-model');
      if (sel) {
        sel.innerHTML = (PROVIDER_MODELS[p] || PROVIDER_MODELS.claude)
          .map(([v, l], i) => `<option value="${v}"${i === (p === 'claude' ? 1 : 0) ? ' selected' : ''}>${esc(l)}</option>`)
          .join('');
      }
      // Kein Key für den Anbieter? → Key-Einfügen-Panel öffnen
      if (!this.state.apiKeys?.[p]) window.keyToolsMgr?._toggleSharePanel?.(p);
    });
  }

  setAgent(agent) {
    this.activeAgent = agent;
    document.querySelectorAll('.agent-tab').forEach(t =>
      t.classList.toggle('agent-tab--active', t.dataset.agent === agent)
    );
    const input = $('chat-input');
    if (input) input.placeholder = `Aufgabe an ${agent.charAt(0).toUpperCase() + agent.slice(1)}…`;
  }

  setAgentDot(agent, status) {
    const tab = document.querySelector(`.agent-tab[data-agent="${agent}"]`);
    const dot = tab?.querySelector('.at-dot');
    if (dot) dot.className = `at-dot dot-${status}`;
  }

  // ── CHAT ─────────────────────────────────────────────────

  setupChatInput() {
    const input   = $('chat-input');
    const sendBtn = $('btn-send');

    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
      setTimeout(() => {
        if (input) {
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        }
      }, 0);
    });
    sendBtn?.addEventListener('click', () => this.send());
  }

  async send() {
    const input = $('chat-input');
    const text  = input?.value.trim();
    if (!text || this.isStreaming) return;
    if (!this.state.activeProjectId) {
      this.newProject(); return;
    }

    input.value = '';
    input.style.height = 'auto';
    this.isStreaming = true;
    this.setAgentDot(this.activeAgent, 'working');
    $('proj-status').className = 'status-badge status-active';
    $('proj-status').textContent = 'arbeitet…';

    // User message
    const userMsg = { id: genId(), role: 'user', content: text, agent: this.activeAgent, ts: Date.now() };
    this.pushMsg(userMsg);
    this.saveMsg(userMsg);

    // Streaming
    const aId = genId();
    let full = '';
    this.showTyping(aId);

    try {
      const context = (this.state.chatMessages || []).slice(-20).map(m => ({
        role: m.role, content: m.content,
      }));

      // Config aus Taskbar (Rollen + Modell)
      const cfg = window.taskbarMgr?.getActiveConfig() || {};
      let sysPrompt = window.taskbarMgr?.buildSystemPrompt()
        || window.AGENT_PROMPTS[this.activeAgent]
        || window.AGENT_PROMPTS.architect;

      // Aktive MCP-Server (Chat-Kontext) an System-Prompt anhängen
      const ctxMcps = (window.mcpMgr?.contextMcps || [])
        .map(id => window.mcpMgr.getActive().find(m => m.id === id))
        .filter(Boolean);
      if (ctxMcps.length) {
        sysPrompt += `\n\nVerfügbare MCP-Server (Tools über HTTP erreichbar):\n` +
          ctxMcps.map(m => `- ${m.name} → ${m.url} (${m.connected ? 'verbunden' : 'offline'})`).join('\n');
      }

      const model    = cfg.model || $('architect-model')?.value || 'claude-sonnet-4-6';
      const provider = $('provider-select')?.value || 'claude';
      const apiKey   = this.state.apiKeys?.[provider];

      if (!apiKey) {
        this.finishTyping(aId, `🔑 Kein API-Key für ${provider} gespeichert. Über den 🔗-Button rechts unten einfügen.`);
        this.isStreaming = false;
        this.setAgentDot(this.activeAgent, 'idle');
        window.keyToolsMgr?._toggleSharePanel?.(provider);
        return;
      }

      await window.api.claudeStream(
        {
          model,
          provider,
          system:    sysPrompt,
          messages:  context,
          apiKey,
        },
        chunk => { full += chunk; this.updateTyping(aId, full); },
        () => {
          this.finishTyping(aId, full);
          const aMsg = { id: aId, role: 'assistant', content: full, agent: this.activeAgent, ts: Date.now() };
          this.pushMsg(aMsg);
          this.saveMsg(aMsg);
          this.setAgentDot(this.activeAgent, 'done');
          $('proj-status').className = 'status-badge status-idle';
          $('proj-status').textContent = 'bereit';
          this.isStreaming = false;
          if (this.voiceActive) {
            const u = new SpeechSynthesisUtterance(full.slice(0, 500));
            u.lang = 'de-DE';
            window.speechSynthesis?.speak(u);
          }
          setTimeout(() => this.setAgentDot(this.activeAgent, 'idle'), 2000);
        },
        err => {
          this.finishTyping(aId, `❌ ${err}`);
          this.setAgentDot(this.activeAgent, 'idle');
          $('proj-status').className = 'status-badge status-idle';
          $('proj-status').textContent = 'bereit';
          this.isStreaming = false;
        }
      );
    } catch (e) {
      this.finishTyping(aId, `❌ ${e.message}`);
      this.setAgentDot(this.activeAgent, 'idle');
      this.isStreaming = false;
    }
  }

  renderMessages() {
    const c = $('messages');
    if (!c) return;
    c.innerHTML = '';
    (this.state.chatMessages || []).forEach(m => this.pushMsg(m, false));
    this.scrollDown();
  }

  pushMsg(msg, animate = true) {
    this.state.chatMessages = this.state.chatMessages || [];
    if (animate) this.state.chatMessages.push(msg);

    const c = $('messages');
    if (!c) return;
    const agentEmoji = { architect:'🏗', researcher:'🔍', coder:'💻', writer:'✍', analyst:'📊' };
    const wrap = document.createElement('div');
    wrap.className = `message ${msg.role}`;
    wrap.dataset.id = msg.id;
    wrap.innerHTML = `
      <div class="msg-avatar">${msg.role === 'user' ? 'Du' : (agentEmoji[msg.agent] || '🤖')}</div>
      <div class="msg-content">${esc(msg.content)}</div>
    `;
    c.appendChild(wrap);
    this.scrollDown();
  }

  showTyping(id) {
    const c = $('messages');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'message assistant';
    el.dataset.id = id;
    el.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-content"><span class="typing-dots">●●●</span></div>`;
    c.appendChild(el);
    this.scrollDown();
  }

  updateTyping(id, text) {
    const el = document.querySelector(`[data-id="${id}"] .msg-content`);
    if (el) el.textContent = text;
    this.scrollDown();
  }

  finishTyping(id, text) {
    const el = document.querySelector(`[data-id="${id}"] .msg-content`);
    if (el) el.textContent = text;
  }

  scrollDown() {
    const c = $('messages');
    if (c) c.scrollTop = c.scrollHeight;
  }

  saveMsg(msg) {
    const p = this.state.projects.find(x => x.id === this.state.activeProjectId);
    if (!p) return;
    p.messages = p.messages || [];
    p.messages.push(msg);
    p.updatedAt = new Date().toISOString();
    window.api.projectAddMessage?.(p.id, msg);
  }

  // ── MIC / VOICE ───────────────────────────────────────────

  setupMicVoice() {
    $('btn-mic')?.addEventListener('click',   () => this.toggleMic());
    $('btn-voice')?.addEventListener('click', () => this.toggleVoice());
  }

  toggleMic() {
    if (this.micActive) {
      this.recognition?.stop();
      this.micActive = false;
      $('btn-mic')?.classList.remove('active');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Spracherkennung nicht verfügbar.'); return; }

    this.recognition = new SR();
    this.recognition.lang = 'de-DE';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.onresult = e => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      const input = $('chat-input');
      if (input) input.value = t;
    };
    this.recognition.onend = () => {
      this.micActive = false;
      $('btn-mic')?.classList.remove('active');
    };
    this.recognition.start();
    this.micActive = true;
    $('btn-mic')?.classList.add('active');
  }

  toggleVoice() {
    this.voiceActive = !this.voiceActive;
    $('btn-voice')?.classList.toggle('active', this.voiceActive);
    window.dispatchEvent(new CustomEvent('voice-mode-changed', { detail: { active: this.voiceActive } }));
  }

  // ── APP TOGGLE (BrowserView) ──────────────────────────────

  setupAppToggle() {
    window.addEventListener('app-open', e => {
      const acc = e.detail;
      // Connector in Main-Process anlegen falls noch nicht da
      window.api.addConnector?.(acc).then(result => {
        const id = result?.instanceId || acc.instanceId;
        window.api.switchCenter?.(id);
      });
    });

    window.addEventListener('app-close', e => {
      window.api.switchCenter?.(null);
    });
  }
}

window.centerMgr = new CenterManager();
