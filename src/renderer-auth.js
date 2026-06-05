// ── Auth System: OAuth / API-Key Wahl + Credential-Speicher ──

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

  // OAuth: öffnet BrowserView mit Login-Seite (Session bleibt via Partition)
  _startOAuth(acc) {
    this.rememberCred(acc.instanceId, 'oauth', acc.label);
    if (!acc.opened) sidebar.toggleApp(acc);
    else { window.api.switchCenter?.(acc.instanceId); }
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
