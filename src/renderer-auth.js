// ── Auth System: OAuth / API-Key Wahl + Credential-Speicher ──

// Universelle Identity-Provider ("Anmelden mit …")
window.OAUTH_PROVIDERS = [
  { id: 'google',    name: 'Google / Gmail',     icon: '🔵', color: '#4285f4', url: 'https://accounts.google.com/signin/v2/identifier' },
  { id: 'microsoft', name: 'Microsoft',          icon: '🪟', color: '#0078d4', url: 'https://login.live.com/' },
  { id: 'github',    name: 'GitHub',             icon: '⚡', color: '#6e7681', url: 'https://github.com/login' },
  { id: 'gitlab',    name: 'GitLab',             icon: '🦊', color: '#fc6d26', url: 'https://gitlab.com/users/sign_in' },
  { id: 'bitbucket', name: 'Bitbucket',          icon: '🪣', color: '#0052cc', url: 'https://bitbucket.org/account/signin/' },
  { id: 'apple',     name: 'Apple',              icon: '🍎', color: '#bbbbbb', url: 'https://account.apple.com/sign-in' },
  { id: 'email',     name: 'E-Mail & Passwort',  icon: '✉',  color: '#9898c0', url: null },
];

class AuthManager {
  constructor() {
    this.state = null;
    // Gespeicherte Credentials pro instanceId: { method, savedAt, hint }
    this.creds = this._load();
  }

  init(state) {
    this.state = state;
    this._injectCSS();
    this._buildMenu();
    this._wireGlobalClose();
  }

  _load() {
    try { return JSON.parse(localStorage.getItem('af_creds')) || {}; }
    catch { return {}; }
  }
  _save() { localStorage.setItem('af_creds', JSON.stringify(this.creds)); }

  // Credential für Account merken (Method + Hinweis, KEIN Klartext-Key hier)
  rememberCred(instanceId, method, hint = '') {
    this.creds[instanceId] = { method, savedAt: new Date().toISOString(), hint };
    this._save();
  }
  getCred(instanceId) { return this.creds[instanceId] || null; }
  forgetCred(instanceId) { delete this.creds[instanceId]; this._save(); }

  // Vorschläge: alle bekannten Labels/Hints für einen templateId (Autocomplete)
  getSuggestions(templateId) {
    const out = [];
    accountMgr.accounts
      .filter(a => a.templateId === templateId)
      .forEach(a => {
        const c = this.creds[a.instanceId];
        out.push({ label: a.label || '(Standard)', method: c?.method || null, hint: c?.hint || '', instanceId: a.instanceId });
      });
    return out;
  }

  // ── CSS ────────────────────────────────────────────────────
  _injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #auth-menu {
        position: fixed; z-index: 950; min-width: 250px;
        background: var(--bg-p); border: 1px solid var(--bd2);
        border-radius: 10px; box-shadow: 0 10px 36px rgba(0,0,0,.6);
        padding: 8px; display: none; animation: fadeUp .14s ease;
      }
      #auth-menu.open { display: block; }
      .am-head {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 8px 10px; border-bottom: 1px solid var(--bd); margin-bottom: 6px;
      }
      .am-head-icon { font-size: 18px; }
      .am-head-name { font-size: 13px; font-weight: 700; }
      .am-head-label { font-size: 10px; color: var(--txt-d); }
      .am-opt {
        display: flex; align-items: center; gap: 10px; padding: 9px 10px;
        border-radius: 8px; cursor: pointer; transition: background .1s;
      }
      .am-opt:hover { background: var(--bg-h); }
      .am-opt-icon { font-size: 17px; flex-shrink: 0; width: 22px; text-align: center; }
      .am-opt-body { flex: 1; min-width: 0; }
      .am-opt-name { font-size: 12px; font-weight: 600; color: var(--txt); }
      .am-opt-desc { font-size: 10px; color: var(--txt-d); }
      .am-status {
        font-size: 10px; padding: 4px 8px; margin: 4px 0;
        background: var(--acc-dim); border-radius: 6px; color: var(--acc2);
      }
      .am-divider { height: 1px; background: var(--bd); margin: 6px 4px; }

      /* x / X Buttons in app-item */
      .app-actions { display: flex; gap: 2px; align-items: center; flex-shrink: 0; }
      .app-x, .app-X {
        width: 18px; height: 18px; background: transparent; border: none;
        color: var(--txt-d); cursor: pointer; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: all .12s; line-height: 1;
      }
      .app-item:hover .app-x, .app-item:hover .app-X { opacity: .7; }
      .app-x { font-size: 11px; }
      .app-X { font-size: 13px; font-weight: 700; }
      .app-x:hover { opacity: 1 !important; background: var(--bg-act); color: var(--txt); }
      .app-X:hover { opacity: 1 !important; background: var(--danger); color: #fff; }

      .auth-badge {
        font-size: 8px; padding: 0 4px; border-radius: 4px;
        flex-shrink: 0; margin-left: 2px;
      }
      .auth-badge.oauth { background: rgba(76,187,148,.2); color: var(--success); }
      .auth-badge.key   { background: rgba(108,99,255,.2);  color: var(--acc2); }

      /* OAuth Provider-Picker ("Anmelden mit …") */
      #oauth-picker {
        position: fixed; inset: 0; z-index: 1100;
        display: none; align-items: center; justify-content: center;
      }
      .op-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.65); }
      .op-card {
        position: relative; z-index: 1; width: 92%; max-width: 380px;
        background: var(--bg-p); border: 1px solid var(--bd2);
        border-radius: 14px; box-shadow: 0 16px 50px rgba(0,0,0,.6);
        overflow: hidden; animation: fadeUp .18s ease;
      }
      .op-head {
        display: flex; align-items: center; gap: 12px;
        padding: 18px 18px 14px; border-bottom: 1px solid var(--bd);
      }
      .op-app-icon { font-size: 26px; flex-shrink: 0; }
      .op-title { font-size: 15px; font-weight: 700; }
      .op-sub   { font-size: 11px; color: var(--txt-d); }
      .op-close {
        margin-left: auto; width: 26px; height: 26px;
        background: transparent; border: 1px solid var(--bd);
        border-radius: 6px; color: var(--txt-d); cursor: pointer; font-size: 12px;
        display: flex; align-items: center; justify-content: center;
      }
      .op-close:hover { background: var(--danger); border-color: var(--danger); color: #fff; }
      .op-providers { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
      .op-provider {
        display: flex; align-items: center; gap: 12px;
        height: 46px; padding: 0 16px;
        background: var(--bg-card); border: 1px solid var(--bd2);
        border-radius: 10px; color: var(--txt); cursor: pointer;
        transition: all .12s; text-align: left; font-size: 13px; font-weight: 500;
      }
      .op-provider:hover { background: var(--bg-h); border-color: var(--acc); transform: translateY(-1px); }
      .op-provider.op-last { border-color: var(--acc-dim); background: rgba(108,99,255,.06); }
      .op-prov-icon { font-size: 20px; flex-shrink: 0; width: 24px; text-align: center; }
      .op-prov-name { flex: 1; }
      .op-prov-badge {
        font-size: 9px; padding: 2px 7px; border-radius: 10px;
        background: var(--acc); color: #fff; flex-shrink: 0;
      }
      .op-hint {
        padding: 0 18px 16px; font-size: 10.5px; color: var(--txt-d); line-height: 1.5;
      }
    `;
    document.head.appendChild(s);
  }

  _buildMenu() {
    const menu = document.createElement('div');
    menu.id = 'auth-menu';
    document.body.appendChild(menu);
  }

  // Öffnet das OAuth/Key-Kontextmenü neben dem Element
  openMenu(acc, anchorEl) {
    const menu = $('auth-menu');
    if (!menu) return;

    const cred = this.getCred(acc.instanceId);
    const isOpen = acc.opened;

    menu.innerHTML = `
      <div class="am-head">
        <span class="am-head-icon" style="color:${acc.color}">${acc.icon}</span>
        <div>
          <div class="am-head-name">${esc(acc.name)}</div>
          <div class="am-head-label">${esc(acc.label || 'Standard')}</div>
        </div>
      </div>
      ${cred ? `<div class="am-status">✓ Zuletzt: ${cred.method === 'oauth' ? '🔓 OAuth' : '🔑 API-Key'}${cred.hint ? ' · ' + esc(cred.hint) : ''}</div>` : ''}

      <div class="am-opt" data-act="oauth">
        <span class="am-opt-icon">🔓</span>
        <div class="am-opt-body">
          <div class="am-opt-name">Mit OAuth anmelden</div>
          <div class="am-opt-desc">Login mit Email, Gmail, GitHub, GitLab…</div>
        </div>
      </div>

      <div class="am-opt" data-act="apikey">
        <span class="am-opt-icon">🔑</span>
        <div class="am-opt-body">
          <div class="am-opt-name">Mit API-Key verbinden</div>
          <div class="am-opt-desc">Direktlink zum Key-Generator + Eingabe</div>
        </div>
      </div>

      ${isOpen ? `
      <div class="am-divider"></div>
      <div class="am-opt" data-act="close">
        <span class="am-opt-icon">✕</span>
        <div class="am-opt-body"><div class="am-opt-name">Schließen</div></div>
      </div>` : ''}
    `;

    // Position neben dem Anker
    const r = anchorEl.getBoundingClientRect();
    menu.style.left = (r.right + 8) + 'px';
    menu.style.top  = r.top + 'px';
    menu.classList.add('open');

    // Falls rechts kein Platz: links zeigen
    requestAnimationFrame(() => {
      const mr = menu.getBoundingClientRect();
      if (mr.right > window.innerWidth - 10) {
        menu.style.left = Math.max(10, r.left - mr.width - 8) + 'px';
      }
      if (mr.bottom > window.innerHeight - 10) {
        menu.style.top = Math.max(10, window.innerHeight - mr.height - 10) + 'px';
      }
    });

    menu.querySelectorAll('.am-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const act = opt.dataset.act;
        this.closeMenu();
        if (act === 'oauth')  this._startOAuth(acc);
        if (act === 'apikey') this._startApiKey(acc);
        if (act === 'close')  sidebar.toggleApp(acc);
      });
    });
  }

  closeMenu() { $('auth-menu')?.classList.remove('open'); }

  _wireGlobalClose() {
    document.addEventListener('click', e => {
      if (!e.target.closest('#auth-menu') && !e.target.closest('.app-item')) {
        this.closeMenu();
      }
    });
  }

  // OAuth: zeigt Provider-Picker ("Anmelden mit …")
  _startOAuth(acc) {
    this._showProviderPicker(acc);
  }

  _showProviderPicker(acc) {
    let overlay = $('oauth-picker');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'oauth-picker';
      document.body.appendChild(overlay);
    }

    const lastProvider = this.getCred(acc.instanceId)?.provider;

    overlay.innerHTML = `
      <div class="op-backdrop"></div>
      <div class="op-card">
        <div class="op-head">
          <span class="op-app-icon" style="color:${acc.color}">${acc.icon}</span>
          <div>
            <div class="op-title">Anmelden bei ${esc(acc.name)}</div>
            <div class="op-sub">${esc(acc.label || 'Standard-Account')}</div>
          </div>
          <button class="op-close" id="op-close">✕</button>
        </div>
        <div class="op-providers">
          ${window.OAUTH_PROVIDERS.map(p => `
            <button class="op-provider${lastProvider === p.id ? ' op-last' : ''}" data-prov="${p.id}">
              <span class="op-prov-icon" style="color:${p.color}">${p.icon}</span>
              <span class="op-prov-name">Weiter mit ${esc(p.name)}</span>
              ${lastProvider === p.id ? '<span class="op-prov-badge">zuletzt</span>' : ''}
            </button>
          `).join('')}
        </div>
        <div class="op-hint">🔒 Login öffnet sich in der isolierten Session dieses Accounts.
          Mehrere Accounts desselben Dienstes bleiben getrennt.</div>
      </div>
    `;
    overlay.style.display = 'flex';

    const close = () => { overlay.style.display = 'none'; };
    $('op-close').addEventListener('click', close);
    overlay.querySelector('.op-backdrop').addEventListener('click', close);

    overlay.querySelectorAll('.op-provider').forEach(btn => {
      btn.addEventListener('click', () => {
        const provId = btn.dataset.prov;
        close();
        this._loginWithProvider(acc, provId);
      });
    });
  }

  _loginWithProvider(acc, providerId) {
    const provider = window.OAUTH_PROVIDERS.find(p => p.id === providerId);
    this.rememberCred(acc.instanceId, 'oauth', acc.label);
    this.creds[acc.instanceId].provider = providerId;
    this._save();

    // 1) Connector-BrowserView öffnen (lädt die Dienst-Seite in eigener Partition)
    if (!acc.opened) sidebar.toggleApp(acc);
    else window.api.switchCenter?.(acc.instanceId);

    // 2) Identity-Provider-Login als Popup in DERSELBEN Partition öffnen
    //    → nach dem Login ist die Session auch im Connector aktiv (SSO greift)
    if (provider?.url) {
      window.api.openOAuthWindow?.({
        url: provider.url,
        partition: acc.partition,
        title: `Anmelden mit ${provider.name}`,
      });
    }
    // 'email' → kein Popup; der User meldet sich direkt auf der Dienst-Seite an
    if (window.sidebar) window.sidebar.render();
  }

  // API-Key: öffnet Key-Tool mit Direktlink für diesen Dienst
  _startApiKey(acc) {
    this.rememberCred(acc.instanceId, 'key', acc.label);
    // Key-Tool öffnen + zum passenden Dienst springen
    window.keyToolsMgr?._toggleLinkPanel();
    setTimeout(() => {
      const search = $('kt-link-search');
      if (search) {
        search.value = acc.name;
        window.keyToolsMgr._renderLinkList(acc.name.toLowerCase());
      }
    }, 120);
  }
}

window.authMgr = new AuthManager();
