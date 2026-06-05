// ── Multi-Account Manager (Global Class) ──────────────────

class AccountManager {
  constructor() {
    this.accounts  = this._load('accounts',  []);
    this.favorites = this._load('favorites', []);
    this.recent    = this._load('recent',    []);
  }

  // Neue Instanz eines Services anlegen (Multi-Account!)
  addInstance(templateId, label = '') {
    const tmpl = window.APP_TEMPLATES[templateId];
    if (!tmpl) return null;
    const inst = {
      instanceId:  genId(),
      templateId,
      cat:         tmpl.cat,
      name:        tmpl.name,
      label:       label || '',
      icon:        tmpl.icon,
      color:       tmpl.color,
      url:         tmpl.url,
      partition:   'persist:' + genId(), // Eigene Session-Isolation!
      opened:      false,
      createdAt:   new Date().toISOString(),
    };
    this.accounts.push(inst);
    this._save('accounts', this.accounts);
    return inst;
  }

  getByCategory(cat) {
    return this.accounts.filter(a => a.cat === cat);
  }

  getById(id) {
    return this.accounts.find(a => a.instanceId === id);
  }

  removeInstance(id) {
    this.accounts = this.accounts.filter(a => a.instanceId !== id);
    this.favorites = this.favorites.filter(f => f !== id);
    this.recent    = this.recent.filter(r => r !== id);
    this._save('accounts',  this.accounts);
    this._save('favorites', this.favorites);
    this._save('recent',    this.recent);
  }

  updateInstance(id, updates) {
    const acc = this.getById(id);
    if (acc) {
      Object.assign(acc, updates);
      this._save('accounts', this.accounts);
    }
  }

  // ⭐ Favorites
  toggleFavorite(id) {
    const idx = this.favorites.indexOf(id);
    if (idx >= 0) this.favorites.splice(idx, 1);
    else this.favorites.push(id);
    this._save('favorites', this.favorites);
  }

  isFavorite(id) { return this.favorites.includes(id); }

  getFavorites() {
    return this.favorites.map(id => this.getById(id)).filter(Boolean);
  }

  // 🕐 Recent
  markRecent(id) {
    this.recent = [id, ...this.recent.filter(r => r !== id)].slice(0, 10);
    this._save('recent', this.recent);
  }

  getRecent() {
    return this.recent.map(id => this.getById(id)).filter(Boolean);
  }

  // Persistence
  _load(key, def) {
    try { return JSON.parse(localStorage.getItem('af_' + key)) || def; }
    catch { return def; }
  }

  _save(key, val) {
    localStorage.setItem('af_' + key, JSON.stringify(val));
  }

  // Seed from old connector format (migration)
  seedFromConnectors(connectors) {
    if (!connectors?.length) return;
    connectors.forEach(c => {
      if (!this.getById(c.instanceId)) {
        this.accounts.push({
          instanceId: c.instanceId,
          templateId: c.id || c.templateId || 'custom',
          cat:        c.cat || 'service',
          name:       c.name,
          label:      c.label || '',
          icon:       c.icon,
          color:      c.color,
          url:        c.url,
          partition:  c.partition || 'persist:' + genId(),
          opened:     false,
          createdAt:  c.createdAt || new Date().toISOString(),
        });
      }
    });
    this._save('accounts', this.accounts);
  }
}

window.accountMgr = new AccountManager();
