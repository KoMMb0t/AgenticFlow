// ── Left Sidebar Manager (Global) ────────────────────────

class LeftSidebarManager {
  constructor() {
    this.collapsed = localStorage.getItem('af_left_collapsed') === 'true';
    this.activeId  = null; // aktuell geöffneter Connector
  }

  init() {
    const panel = $('left-panel');
    if (panel) panel.classList.toggle('collapsed', this.collapsed);

    const btn = $('left-toggle');
    if (btn) {
      btn.classList.toggle('active', !this.collapsed);
      btn.addEventListener('click', () => this.toggleCollapse());
    }

    this.setupAddButtons();
    this.setupNetworkPanel();
    this.render();
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    localStorage.setItem('af_left_collapsed', this.collapsed ? 'true' : 'false');
    $('left-panel')?.classList.toggle('collapsed', this.collapsed);
    $('left-toggle')?.classList.toggle('active', !this.collapsed);
  }

  render() {
    const catMap = {
      cloud:   'clouds-list',
      browser: 'browser-list',
      channel: 'channels-list',
      service: 'services-list',
      ai:      null, // AI geht in Header-Tabs, nicht Sidebar
    };

    for (const [cat, listId] of Object.entries(catMap)) {
      if (!listId) continue;
      const list = $(listId);
      if (!list) continue;
      const accounts = accountMgr.getByCategory(cat).filter(a => !a.hidden);
      list.innerHTML = '';
      if (!accounts.length) {
        list.innerHTML = '<div class="empty-hint">Noch nichts verbunden</div>';
      } else {
        accounts.forEach(acc => list.appendChild(this.makeItem(acc)));
      }
    }

    // Favorites
    const favs = accountMgr.getFavorites();
    const favSec  = $('favorites-section');
    const favList = $('favorites-list');
    if (favSec && favList) {
      favSec.style.display = favs.length ? 'block' : 'none';
      favList.innerHTML = '';
      favs.forEach(acc => favList.appendChild(this.makeItem(acc)));
    }

    // Recent
    const recent     = accountMgr.getRecent();
    const recentSec  = $('recent-section');
    const recentList = $('recent-list');
    if (recentSec && recentList) {
      recentSec.style.display = recent.length ? 'block' : 'none';
      recentList.innerHTML = '';
      recent.slice(0, 5).forEach(acc => recentList.appendChild(this.makeItem(acc)));
    }

    // AI Tabs im Header
    this.renderAITabs();
  }

  makeItem(acc) {
    const el = document.createElement('div');
    const fav  = accountMgr.isFavorite(acc.instanceId);
    const cred = window.authMgr?.getCred(acc.instanceId);
    el.className = `app-item${acc.opened ? ' active' : ''}${fav ? ' pinned' : ''}`;
    el.dataset.id = acc.instanceId;
    el.title = `${acc.name}${acc.label ? ' — ' + acc.label : ''}`;

    const badge = cred
      ? `<span class="auth-badge ${cred.method === 'oauth' ? 'oauth' : 'key'}">${cred.method === 'oauth' ? 'OAuth' : 'Key'}</span>`
      : '';

    el.innerHTML = `
      <span class="app-icon" style="color:${acc.color}">${acc.icon}</span>
      <div class="app-info">
        <div class="app-name">${esc(acc.name)}${badge}</div>
        <div class="app-label">${esc(acc.label || '(Standard)')}</div>
      </div>
      <div class="app-actions">
        <button class="app-pin-btn" title="${fav ? 'Aus Favoriten' : 'Zu Favoriten'}">${fav ? '⭐' : '☆'}</button>
        <button class="app-x" title="Aus Sidebar entfernen (Daten bleiben)">✕</button>
        <button class="app-X" title="Komplett löschen (inkl. Login-Daten)">✕</button>
      </div>
    `;

    // Klick auf Item → Auth-Menü (OAuth / API-Key)
    el.addEventListener('click', e => {
      if (e.target.closest('.app-actions')) return;
      if (acc.opened) {
        // Schon offen → direkt anzeigen/fokussieren
        window.api.switchCenter?.(acc.instanceId);
        return;
      }
      window.authMgr?.openMenu(acc, el);
    });

    // ⭐ Pin
    el.querySelector('.app-pin-btn').addEventListener('click', e => {
      e.stopPropagation();
      accountMgr.toggleFavorite(acc.instanceId);
      this.render();
    });

    // ✕ klein: aus Sidebar entfernen (Daten bleiben)
    el.querySelector('.app-x').addEventListener('click', e => {
      e.stopPropagation();
      if (acc.opened) { window.dispatchEvent(new CustomEvent('app-close', { detail: acc })); }
      accountMgr.updateInstance(acc.instanceId, { hidden: true, opened: false });
      if (this.activeId === acc.instanceId) this.activeId = null;
      this.render();
    });

    // ✕ groß: komplett löschen
    el.querySelector('.app-X').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`"${acc.name}${acc.label ? ' — ' + acc.label : ''}" komplett löschen?\n\nInkl. gespeicherter Login-/Key-Daten.`)) return;
      if (acc.opened) { window.dispatchEvent(new CustomEvent('app-close', { detail: acc })); }
      window.authMgr?.forgetCred(acc.instanceId);
      window.api.removeConnector?.(acc.instanceId);
      accountMgr.removeInstance(acc.instanceId);
      if (this.activeId === acc.instanceId) this.activeId = null;
      this.render();
    });

    return el;
  }

  toggleApp(acc) {
    if (this.activeId === acc.instanceId) {
      // Schließen
      acc.opened = false;
      accountMgr.updateInstance(acc.instanceId, { opened: false });
      this.activeId = null;
      window.dispatchEvent(new CustomEvent('app-close', { detail: acc }));
    } else {
      // Vorheriges schließen
      if (this.activeId) {
        const prev = accountMgr.getById(this.activeId);
        if (prev) {
          prev.opened = false;
          accountMgr.updateInstance(this.activeId, { opened: false });
          window.dispatchEvent(new CustomEvent('app-close', { detail: prev }));
        }
      }
      // Öffnen
      acc.opened = true;
      accountMgr.updateInstance(acc.instanceId, { opened: true });
      accountMgr.markRecent(acc.instanceId);
      this.activeId = acc.instanceId;
      window.dispatchEvent(new CustomEvent('app-open', { detail: acc }));
    }
    this.render();
  }

  renderAITabs() {
    const nav = $('ai-tabs');
    if (!nav) return;
    // Entferne alte AI-Tabs (behalte Home-Tab)
    nav.querySelectorAll('.tab[data-type="ai"]').forEach(t => t.remove());

    // AI-Accounts aus accountMgr
    const aiAccounts = accountMgr.getByCategory('ai').filter(a => !a.hidden);
    aiAccounts.forEach(acc => {
      const tab = document.createElement('button');
      tab.className = `tab${acc.opened ? ' tab--active' : ''}`;
      tab.dataset.type = 'ai';
      tab.dataset.id   = acc.instanceId;
      tab.title = acc.label || acc.name;
      tab.innerHTML = `<span>${acc.icon}</span><span class="tl">${esc(acc.label || acc.name)}</span>
        <button class="tab-x" title="Schließen">✕</button>`;

      tab.querySelector('.tab-x').addEventListener('click', e => {
        e.stopPropagation();
        this.toggleApp(acc);
      });
      tab.addEventListener('click', e => {
        if (e.target.classList.contains('tab-x')) return;
        this.toggleApp(acc);
      });
      nav.appendChild(tab);
    });
  }

  setupAddButtons() {
    const map = {
      'add-cloud-btn':   'cloud',
      'add-browser-btn': 'browser',
      'add-channel-btn': 'channel',
      'add-service-btn': 'service',
    };
    for (const [id, cat] of Object.entries(map)) {
      $(id)?.addEventListener('click', () => openAddModal(cat));
    }
  }

  setupNetworkPanel() {
    $('btn-network-scan')?.addEventListener('click', () => {
      const btn = $('btn-network-scan');
      if (btn) { btn.style.transition = 'transform .6s'; btn.style.transform = 'rotate(360deg)'; }
      setTimeout(() => { if (btn) btn.style.transform = ''; }, 700);
      window.loadNetworkInfo?.();
    });

    $('btn-ble-scan')?.addEventListener('click', () => window.loadNetworkInfo?.());

    const accBtn = $('btn-network-access');
    if (accBtn) {
      const enabled = localStorage.getItem('af_network_access') === 'true';
      accBtn.classList.toggle('enabled', enabled);
      accBtn.querySelector('span:last-child').textContent = enabled ? '✓ Freigegeben' : 'Freischalten';

      accBtn.addEventListener('click', () => {
        const newVal = !accBtn.classList.contains('enabled');
        accBtn.classList.toggle('enabled', newVal);
        accBtn.querySelector('span:last-child').textContent = newVal ? '✓ Freigegeben' : 'Freischalten';
        localStorage.setItem('af_network_access', newVal ? 'true' : 'false');
        window.api.setNetworkAccess?.(newVal);
      });
    }
  }
}

window.sidebar = new LeftSidebarManager();
