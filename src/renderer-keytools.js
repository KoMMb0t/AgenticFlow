// ── Key Tools: API-Key-Direktlinks + Key einfügen ────────

// 33 Dienste mit Direktlinks zu ihren API-Key-Seiten
window.API_KEY_SERVICES = [
  { section: '🤖 KI-Agenten & APIs' },
  { name: 'Anthropic (Claude)', icon: '⚗', color: '#cc785c', desc: 'Claude Opus, Sonnet, Haiku', url: 'https://console.anthropic.com/settings/keys', scope: 'API Keys verwalten' },
  { name: 'OpenAI (ChatGPT)',   icon: '🤖', color: '#10a37f', desc: 'GPT-4o, o1 — API Keys', url: 'https://platform.openai.com/api-keys', scope: 'Neuen Key → All' },
  { name: 'Google AI (Gemini)', icon: '✦', color: '#4285f4', desc: 'Gemini Pro / Flash', url: 'https://aistudio.google.com/app/apikey', scope: 'API Key erstellen' },
  { name: 'Perplexity AI',      icon: '◎', color: '#20808d', desc: 'pplx-api Key', url: 'https://www.perplexity.ai/settings/api', scope: 'Generate → Full' },
  { name: 'Mistral AI',         icon: 'M', color: '#ff7000', desc: 'Mistral Large / Small', url: 'https://console.mistral.ai/api-keys/', scope: 'Create new key' },
  { name: 'Groq',               icon: '⚡', color: '#f55036', desc: 'Llama 3, Mixtral schnell', url: 'https://console.groq.com/keys', scope: 'Create API Key' },
  { name: 'Cohere',             icon: 'C', color: '#39594d', desc: 'Command R+ API', url: 'https://dashboard.cohere.com/api-keys', scope: 'read+write' },

  { section: '☁ Cloud-Speicher' },
  { name: 'Google Drive (OAuth)', icon: '📁', color: '#0f9d58', desc: 'Cloud Console → Drive API', url: 'https://console.cloud.google.com/apis/credentials', scope: 'OAuth Client → Desktop' },
  { name: 'Dropbox',              icon: '📦', color: '#0061ff', desc: 'App → Token generieren', url: 'https://www.dropbox.com/developers/apps', scope: 'Full Dropbox → Token' },
  { name: 'MEGA',                 icon: '🔒', color: '#d9272e', desc: 'MEGAcmd / MEGA-SDK', url: 'https://mega.io/developers', scope: 'API via MEGAcmd' },
  { name: 'OneDrive (Microsoft)', icon: '☁', color: '#0078d4', desc: 'Azure App Registration', url: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps', scope: 'Files.ReadWrite.All' },

  { section: '⚡ Entwicklung & Tools' },
  { name: 'GitHub',              icon: '⚡', color: '#58a6ff', desc: 'Personal Access Token (Classic)', url: 'https://github.com/settings/tokens/new', scope: 'repo, delete_repo, workflow' },
  { name: 'GitHub Fine-Grained', icon: '⚡', color: '#3d8bff', desc: 'Granulare Rechte pro Repo', url: 'https://github.com/settings/personal-access-tokens/new', scope: 'Contents: Read & Write' },
  { name: 'GitLab',              icon: '🦊', color: '#fc6d26', desc: 'Personal Access Token', url: 'https://gitlab.com/-/user_settings/personal_access_tokens', scope: 'api, read_repo, write_repo' },
  { name: 'Bitbucket',          icon: '🪣', color: '#0052cc', desc: 'App Password', url: 'https://bitbucket.org/account/settings/app-passwords/new', scope: 'Repositories Read+Write' },
  { name: 'Google Cloud',       icon: '☁', color: '#4285f4', desc: 'Service Account / API Key', url: 'https://console.cloud.google.com/apis/credentials', scope: 'API Key / Service Account' },
  { name: 'Notion',             icon: 'N', color: '#ffffff', desc: 'Integration → Internal token', url: 'https://www.notion.so/my-integrations', scope: 'Full workspace' },
  { name: 'Slack',              icon: 'S', color: '#4a154b', desc: 'Bot Token (xoxb)', url: 'https://api.slack.com/apps', scope: 'OAuth → xoxb Token' },
  { name: 'kChat (Infomaniak)', icon: '💬', color: '#1a73e8', desc: 'Infomaniak API Token', url: 'https://manager.infomaniak.com/v3/profile/api-token', scope: 'kChat-Zugriff' },
  { name: 'Infomaniak Mail',    icon: '📮', color: '#1a73e8', desc: 'Mail API / IMAP', url: 'https://manager.infomaniak.com/v3/profile/api-token', scope: 'Mail-Dienste' },

  { section: '💬 Kommunikation' },
  { name: 'Telegram Bot', icon: 'T', color: '#0088cc', desc: 'BotFather → /newbot', url: 'https://t.me/BotFather', scope: '/newbot → Token' },
  { name: 'Discord',      icon: 'D', color: '#5865f2', desc: 'Bot-Token Developer Portal', url: 'https://discord.com/developers/applications', scope: 'Bot → Reset Token' },
  { name: 'Twilio',       icon: '📱', color: '#f22f46', desc: 'Account SID + Auth Token', url: 'https://console.twilio.com/', scope: 'Account Info' },

  { section: '🔧 Sonstige' },
  { name: 'Hugging Face', icon: '🤗', color: '#ff9d00', desc: 'Access Token Models/Inference', url: 'https://huggingface.co/settings/tokens', scope: 'Type: Write' },
  { name: 'Replicate',    icon: '🔄', color: '#6b7280', desc: 'Open-Source-Modelle', url: 'https://replicate.com/account/api-tokens', scope: 'Create token' },
  { name: 'ElevenLabs',   icon: '🎙', color: '#9b5de5', desc: 'Text-to-Speech API', url: 'https://elevenlabs.io/app/settings/api-keys', scope: 'Creator+' },
  { name: 'Serper',       icon: '🔍', color: '#ea4335', desc: 'Google Search API', url: 'https://serper.dev/api-key', scope: 'API Key' },
];

// Dienste zum direkten Key-Speichern
window.KEY_SHARE_SERVICES = [
  { id: 'claude', name: '⚗ Anthropic (Claude)' },
  { id: 'openai', name: '🤖 OpenAI' },
  { id: 'gemini', name: '✦ Google Gemini' },
  { id: 'perplexity', name: '◎ Perplexity' },
  { id: 'mistral', name: 'M Mistral' },
  { id: 'groq', name: '⚡ Groq' },
  { id: 'cohere', name: 'C Cohere' },
  { id: 'github', name: '⚡ GitHub' },
  { id: 'gitlab', name: '🦊 GitLab' },
  { id: 'dropbox', name: '📦 Dropbox' },
  { id: 'notion', name: 'N Notion' },
  { id: 'slack', name: 'S Slack' },
  { id: 'custom', name: '⚙ Eigener Dienst' },
];

class KeyToolsManager {
  constructor() { this.state = null; }

  init(state) {
    this.state = state;
    this._injectCSS();
    this._buildPanels();
    this._wireButtons();
  }

  // ── CSS ────────────────────────────────────────────────────
  _injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      .kt-overlay {
        position: fixed; inset: 0; z-index: 900; display: none;
        background: rgba(0,0,0,.5);
      }
      .kt-overlay.open { display: block; }
      .kt-panel {
        position: fixed; right: 16px; bottom: 70px; z-index: 901;
        width: 340px; max-height: 70vh;
        background: var(--bg-p); border: 1px solid var(--bd2);
        border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.6);
        display: none; flex-direction: column; overflow: hidden;
      }
      .kt-panel.open { display: flex; }
      .kt-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px; border-bottom: 1px solid var(--bd); flex-shrink: 0;
        font-size: 13px; font-weight: 700;
      }
      .kt-close {
        width: 24px; height: 24px; background: transparent; border: 1px solid var(--bd);
        border-radius: 5px; color: var(--txt-d); cursor: pointer; font-size: 12px;
        display: flex; align-items: center; justify-content: center;
      }
      .kt-close:hover { background: var(--danger); border-color: var(--danger); color: #fff; }
      .kt-search {
        margin: 10px 12px; height: 32px; padding: 0 10px;
        background: var(--bg-card); border: 1px solid var(--bd);
        border-radius: 7px; color: var(--txt); font-size: 12px; outline: none;
      }
      .kt-search:focus { border-color: var(--acc); }
      .kt-list { flex: 1; overflow-y: auto; padding: 0 8px 10px; }
      .kt-list::-webkit-scrollbar { width: 4px; }
      .kt-list::-webkit-scrollbar-thumb { background: var(--bd2); border-radius: 2px; }
      .kt-section {
        font-size: 9.5px; font-weight: 700; color: var(--txt-d);
        text-transform: uppercase; letter-spacing: .06em;
        padding: 10px 8px 5px;
      }
      .kt-item {
        display: flex; align-items: center; gap: 9px; padding: 7px 8px;
        border-radius: 8px; cursor: pointer; transition: background .1s;
      }
      .kt-item:hover { background: var(--bg-h); }
      .kt-icon {
        width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center; font-size: 15px;
      }
      .kt-info { flex: 1; min-width: 0; }
      .kt-name { font-size: 12px; font-weight: 600; color: var(--txt); }
      .kt-desc { font-size: 10px; color: var(--txt-d); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .kt-go {
        flex-shrink: 0; height: 26px; padding: 0 10px;
        background: var(--acc); border: none; border-radius: 6px;
        color: #fff; font-size: 11px; cursor: pointer; transition: background .12s;
      }
      .kt-go:hover { background: var(--acc2); }

      .kt-share-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
      .kt-share-body select, .kt-share-body input {
        height: 34px; padding: 0 10px;
        background: var(--bg-card); border: 1px solid var(--bd);
        border-radius: 7px; color: var(--txt); font-size: 12px; outline: none;
      }
      .kt-share-body select:focus, .kt-share-body input:focus { border-color: var(--acc); }
      .kt-share-hint { font-size: 10px; color: var(--txt-d); line-height: 1.5; }
      .kt-share-save {
        height: 34px; background: var(--acc); border: none; border-radius: 7px;
        color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; transition: background .12s;
      }
      .kt-share-save:hover { background: var(--acc2); }
      .kt-share-status { font-size: 11px; color: var(--success); text-align: center; min-height: 16px; }
    `;
    document.head.appendChild(s);
  }

  // ── Panels in DOM bauen ────────────────────────────────────
  _buildPanels() {
    // API-Key Direktlinks Panel
    const linkOverlay = document.createElement('div');
    linkOverlay.className = 'kt-overlay';
    linkOverlay.id = 'kt-link-overlay';

    const linkPanel = document.createElement('div');
    linkPanel.className = 'kt-panel';
    linkPanel.id = 'kt-link-panel';
    linkPanel.innerHTML = `
      <div class="kt-head">
        <span>🔑 API-Key Direktlinks</span>
        <button class="kt-close" id="kt-link-close">✕</button>
      </div>
      <input class="kt-search" id="kt-link-search" placeholder="Dienst suchen…">
      <div class="kt-list" id="kt-link-list"></div>
    `;

    // Key einfügen Panel
    const shareOverlay = document.createElement('div');
    shareOverlay.className = 'kt-overlay';
    shareOverlay.id = 'kt-share-overlay';

    const sharePanel = document.createElement('div');
    sharePanel.className = 'kt-panel';
    sharePanel.id = 'kt-share-panel';
    sharePanel.innerHTML = `
      <div class="kt-head">
        <span>🔗 Key einfügen</span>
        <button class="kt-close" id="kt-share-close">✕</button>
      </div>
      <div class="kt-share-body">
        <select id="kt-share-service">
          ${window.KEY_SHARE_SERVICES.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>
        <input id="kt-share-input" type="password" placeholder="API-Key hier einfügen…">
        <button class="kt-share-save" id="kt-share-save">Lokal speichern</button>
        <div class="kt-share-status" id="kt-share-status"></div>
        <div class="kt-share-hint">🔒 Keys werden nur lokal gespeichert (electron-store) — nie im Repo oder online.</div>
      </div>
    `;

    document.body.appendChild(linkOverlay);
    document.body.appendChild(linkPanel);
    document.body.appendChild(shareOverlay);
    document.body.appendChild(sharePanel);
  }

  // ── Buttons (im rechten #buttons-panel) verdrahten ────────
  _wireButtons() {
    // 🔑 API-Key Direktlinks
    $('btn-action-1')?.addEventListener('click', () => this._toggleLinkPanel());
    // 🔗 Key einfügen
    $('btn-action-2')?.addEventListener('click', () => this._toggleSharePanel());

    // Link-Panel
    $('kt-link-close')?.addEventListener('click', () => this._closeLinkPanel());
    $('kt-link-overlay')?.addEventListener('click', () => this._closeLinkPanel());
    $('kt-link-search')?.addEventListener('input', e => this._renderLinkList(e.target.value.trim().toLowerCase()));

    // Share-Panel
    $('kt-share-close')?.addEventListener('click', () => this._closeSharePanel());
    $('kt-share-overlay')?.addEventListener('click', () => this._closeSharePanel());
    $('kt-share-save')?.addEventListener('click', () => this._saveKey());
    $('kt-share-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._saveKey(); });
  }

  _toggleLinkPanel() {
    const panel = $('kt-link-panel'), overlay = $('kt-link-overlay');
    const open = panel.classList.contains('open');
    if (open) { this._closeLinkPanel(); return; }
    this._closeSharePanel();
    panel.classList.add('open'); overlay.classList.add('open');
    this._renderLinkList('');
    setTimeout(() => $('kt-link-search')?.focus(), 80);
  }
  _closeLinkPanel() {
    $('kt-link-panel')?.classList.remove('open');
    $('kt-link-overlay')?.classList.remove('open');
  }

  _toggleSharePanel() {
    const panel = $('kt-share-panel'), overlay = $('kt-share-overlay');
    const open = panel.classList.contains('open');
    if (open) { this._closeSharePanel(); return; }
    this._closeLinkPanel();
    panel.classList.add('open'); overlay.classList.add('open');
    setTimeout(() => $('kt-share-input')?.focus(), 80);
  }
  _closeSharePanel() {
    $('kt-share-panel')?.classList.remove('open');
    $('kt-share-overlay')?.classList.remove('open');
  }

  _renderLinkList(query) {
    const list = $('kt-link-list');
    if (!list) return;
    list.innerHTML = '';
    let section = null;

    for (const e of window.API_KEY_SERVICES) {
      if (e.section) { section = e.section; continue; }
      if (query && !e.name.toLowerCase().includes(query) && !e.desc.toLowerCase().includes(query)) continue;

      if (section) {
        const h = document.createElement('div');
        h.className = 'kt-section'; h.textContent = section;
        list.appendChild(h); section = null;
      }

      const item = document.createElement('div');
      item.className = 'kt-item'; item.title = e.scope || '';
      item.innerHTML = `
        <div class="kt-icon" style="background:${e.color}22;color:${e.color}">${e.icon}</div>
        <div class="kt-info">
          <div class="kt-name">${esc(e.name)}</div>
          <div class="kt-desc">${esc(e.desc)}</div>
        </div>
        <button class="kt-go">↗ Öffnen</button>`;
      const go = () => window.api.openExternal?.(e.url);
      item.querySelector('.kt-go').addEventListener('click', ev => { ev.stopPropagation(); go(); });
      item.addEventListener('click', go);
      list.appendChild(item);
    }
    if (!list.children.length) {
      list.innerHTML = `<div class="empty-hint">Kein Dienst für "${esc(query)}"</div>`;
    }
  }

  _saveKey() {
    const service = $('kt-share-service')?.value;
    const key     = $('kt-share-input')?.value.trim();
    const status  = $('kt-share-status');
    if (!key) { if (status) status.textContent = '⚠ Bitte Key einfügen'; return; }
    window.api.saveApiKey?.(service, key);
    if (this.state) this.state.apiKeys[service] = key;
    $('kt-share-input').value = '';
    if (status) status.textContent = `✓ ${service}-Key lokal gespeichert`;
    setTimeout(() => { if (status) status.textContent = ''; this._closeSharePanel(); }, 1600);
  }
}

window.keyToolsMgr = new KeyToolsManager();
