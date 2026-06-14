/**
 * Perfect Memory (lernend) — schlanker Prototyp für AgenticFlow
 * --------------------------------------------------------------
 * Schema/Mechanik abgeleitet aus agentic-flow / claude-flow v3
 * (auto-memory-hook + LearningBridge): Decay, Access-Boost, Konsolidierung.
 * Reines JS, kein Rust/WASM. Speichert in electron-store unter STORE_KEY.
 *
 * Stört das bestehende Perfect Memory NICHT — eigener Key 'perfectMemoryLearn'.
 *
 * Einbinden (im Main-Prozess):
 *   const { registerPerfectMemory } = require('./perfect-memory');
 *   const pm = registerPerfectMemory(store, ipcMain);
 */

const STORE_KEY = 'perfectMemoryLearn';

const DEFAULTS = {
  confidenceDecayRate: 0.005,   // Confidence-Verlust pro Tag ohne Zugriff
  accessBoostAmount:   0.03,    // Confidence-Gewinn pro Zugriff
  consolidationThreshold: 10,   // ab so vielen Zugriffen → feste Erkenntnis
};

const TYPES = ['semantic', 'episodic', 'procedural', 'working']; // kognitives Modell

const now = () => Date.now();
const uuid = () => 'pm_' + now().toString(36) + Math.random().toString(36).slice(2, 8);
const norm = (t) => String(t || '').toLowerCase();

class PerfectMemory {
  constructor(store, cfg = {}) {
    this.store = store;            // electron-store-kompatibel: .get(key, def) / .set(key, val)
    this.cfg = { ...DEFAULTS, ...cfg };
  }

  _all() { return this.store.get(STORE_KEY, []); }
  _save(list) { this.store.set(STORE_KEY, list); return list; }

  /** Neue Erinnerung anlegen. */
  add({ content, type = 'semantic', scope = 'global', tags = [], metadata = {} }) {
    if (!content) return null;
    const e = {
      id: uuid(), scope, type: TYPES.includes(type) ? type : 'semantic',
      content, tags: tags.map(norm),
      confidence: 0.5, accessCount: 0, lastAccess: now(),
      outcomes: { success: 0, fail: 0 }, metadata,
      createdAt: now(), updatedAt: now(),
    };
    const list = this._all(); list.push(e); this._save(list);
    return e;
  }

  /** Ergebnis einer Aktion protokollieren (episodic → daraus lernt das Routing). */
  recordOutcome({ task, bubbleId = null, provider = null, model = null, success = true, durationMs = null, tags = [] }) {
    const e = {
      id: uuid(), scope: bubbleId ? `bubble:${bubbleId}` : 'global', type: 'episodic',
      content: task || '', tags: [...tags, provider, model].filter(Boolean).map(norm),
      confidence: success ? 0.6 : 0.3, accessCount: 0, lastAccess: now(),
      outcomes: { success: success ? 1 : 0, fail: success ? 0 : 1 },
      metadata: { bubbleId, provider, model, durationMs },
      createdAt: now(), updatedAt: now(),
    };
    const list = this._all(); list.push(e); this._save(list);
    return e;
  }

  /** Erinnerung beim Zugriff verstärken (+ ggf. konsolidieren). */
  reinforce(id) {
    const list = this._all();
    const e = list.find(x => x.id === id);
    if (!e) return null;
    e.accessCount += 1; e.lastAccess = now();
    e.confidence = Math.min(1, e.confidence + this.cfg.accessBoostAmount);
    e.updatedAt = now();
    this._consolidate(e, list);
    this._save(list);
    return e;
  }

  /** Confidence über Zeit altern lassen — z.B. einmal beim App-Start. */
  decay() {
    const list = this._all(); const t = now(); const DAY = 86400000;
    for (const e of list) {
      const days = (t - (e.lastAccess || e.createdAt)) / DAY;
      e.confidence = Math.max(0, e.confidence - this.cfg.confidenceDecayRate * days);
    }
    return this._save(list).length;
  }

  /** Stichwort-/Tag-Ähnlichkeit (einfacher Recall; später optional Vektorsuche). */
  recall(query, { scope = null, type = null, limit = 5 } = {}) {
    const terms = norm(query).match(/[a-z0-9äöüß]{3,}/g) || [];
    let list = this._all();
    if (scope) list = list.filter(e => e.scope === scope);
    if (type) list = list.filter(e => e.type === type);
    const scored = list.map(e => {
      const hay = norm(e.content + ' ' + (e.tags || []).join(' '));
      let overlap = 0; for (const t of terms) if (hay.includes(t)) overlap++;
      const score = overlap + e.confidence * 0.5 + Math.log1p(e.accessCount) * 0.2;
      return { e, score, overlap };
    }).filter(x => x.overlap > 0 || x.e.confidence >= 0.75);
    scored.sort((a, b) => b.score - a.score);
    // Treffer leicht verstärken (sie waren nützlich)
    const top = scored.slice(0, limit).map(x => x.e);
    return top;
  }

  /** Routing-Vorschlag: welcher Provider/welches Modell hat bei ähnlichen Aufgaben funktioniert. */
  suggestRoute(task, { limit = 30 } = {}) {
    const hits = this.recall(task, { type: 'episodic', limit });
    const tally = {};
    for (const e of hits) {
      const provider = e.metadata?.provider, model = e.metadata?.model;
      const k = `${provider || '?'}|${model || '?'}`;
      tally[k] = tally[k] || { provider, model, success: 0, fail: 0, weight: 0 };
      tally[k].success += e.outcomes.success;
      tally[k].fail += e.outcomes.fail;
      tally[k].weight += e.confidence;
    }
    const ranked = Object.values(tally)
      .map(r => ({ ...r, winRate: r.success / (r.success + r.fail || 1), score: (r.success - r.fail) + r.weight }))
      .sort((a, b) => b.score - a.score);
    return ranked[0] || null;   // null = noch nichts gelernt
  }

  /** Episodic-Erfahrung nach Schwelle zu fester semantic-Erkenntnis verdichten. */
  _consolidate(e, list) {
    if (e.type === 'episodic' && e.accessCount >= this.cfg.consolidationThreshold) {
      list.push({
        id: uuid(), scope: e.scope, type: 'semantic',
        content: `Bewährt: ${e.content}`, tags: e.tags,
        confidence: Math.min(1, e.confidence + 0.1), accessCount: 0, lastAccess: now(),
        outcomes: { ...e.outcomes }, metadata: { consolidatedFrom: e.id },
        createdAt: now(), updatedAt: now(),
      });
    }
  }

  remove(id) {
    const list = this._all().filter(e => e.id !== id);
    this._save(list); return true;
  }

  stats() {
    const l = this._all(); const byType = {};
    for (const e of l) byType[e.type] = (byType[e.type] || 0) + 1;
    return { total: l.length, byType, avgConfidence: l.reduce((s, e) => s + e.confidence, 0) / (l.length || 1) };
  }
}

/** Optionale IPC-Anbindung für den Renderer (window.api.pm*). */
function registerPerfectMemory(store, ipcMain, cfg = {}) {
  const pm = new PerfectMemory(store, cfg);
  try { pm.decay(); } catch { /* best effort */ }
  ipcMain.handle('pm-add',            (_, p)        => pm.add(p));
  ipcMain.handle('pm-recall',         (_, q, o)     => pm.recall(q, o));
  ipcMain.handle('pm-record-outcome', (_, p)        => pm.recordOutcome(p));
  ipcMain.handle('pm-suggest-route',  (_, task, o)  => pm.suggestRoute(task, o));
  ipcMain.handle('pm-reinforce',      (_, id)       => pm.reinforce(id));
  ipcMain.handle('pm-remove',         (_, id)       => pm.remove(id));
  ipcMain.handle('pm-stats',          ()           => pm.stats());
  return pm;
}

module.exports = { PerfectMemory, registerPerfectMemory, STORE_KEY, DEFAULTS, TYPES };
