# Perfect Memory (lernend) — Bauplan

> Ziel: Aus dem statischen „Perfect Memory" ein **lernendes** Gedächtnis machen, das sich an
> die Arbeitsweise des Nutzers anpasst. Schema/Mechanik abgeleitet aus **agentic-flow / claude-flow v3**
> (`auto-memory-hook.mjs`, `LearningBridge`, AgentDB). Hier als **schlanke, reine-JS-Variante** umgesetzt.

Referenz-Implementierung: [`src/perfect-memory.js`](../src/perfect-memory.js)

---

## 1. Datenmodell (ein Eintrag)

```js
{
  id, scope,                 // scope = 'global' | 'project:X' | 'bubble:Y' | 'user-prefs'
  type,                      // semantic | episodic | procedural | working
  content,                   // Inhalt / Insight / Aufgabe
  tags: [...],               // klein geschrieben; u.a. provider, model
  confidence,                // 0..1 — lernt: +bei Nutzung, −Decay über Zeit
  accessCount, lastAccess,
  outcomes: { success, fail },
  metadata: { bubbleId, provider, model, durationMs, ... },
  createdAt, updatedAt
}
```

Gespeichert in **electron-store** unter dem Key `perfectMemoryLearn` (getrennt vom bestehenden
`perfectMemory`, damit nichts bricht).

### Gedächtnis-Typen (kognitives Modell)
| Typ | Bedeutung |
|-----|-----------|
| `semantic` | Fakten/Wissen ("Nutzer bevorzugt Claude für Code") |
| `episodic` | Ereignisse/Aktionen mit Ergebnis (eine konkrete Bubble-Antwort) |
| `procedural` | bewährte Abläufe/Patterns |
| `working` | aktueller Kontext (kurzlebig) |

---

## 2. Lern-Mechanik (die echten Parameter)

| Parameter | Wert | Wirkung |
|-----------|------|---------|
| `confidenceDecayRate` | 0.005 / Tag | Ungenutztes verblasst langsam |
| `accessBoostAmount` | 0.03 / Zugriff | Genutztes wird wichtiger |
| `consolidationThreshold` | 10 Zugriffe | episodic → feste `semantic`-Erkenntnis |

**Outcome-Loop:** vor Aktion Vorschlag (Recall ähnlicher Fälle) → nach Aktion **Ergebnis protokollieren**
(`recordOutcome`: Bubble, Provider/Modell, Erfolg?, Dauer). Daraus wird das Routing besser.

(Optional später, aus agentic-flow: MemoryGraph mit PageRank-Ranking & Similarity-Linking 0.8;
AgentDB mit echter HNSW-Vektorsuche + RL-Algorithmen.)

---

## 3. API (`PerfectMemory`)

```js
const { registerPerfectMemory } = require('./perfect-memory');
const pm = registerPerfectMemory(store, ipcMain); // legt IPC-Handler an + altert beim Start

pm.add({ content, type, scope, tags, metadata });
pm.recordOutcome({ task, bubbleId, provider, model, success, durationMs });
pm.recall(query, { scope, type, limit });   // Stichwort-/Tag-Ähnlichkeit
pm.suggestRoute(task);                       // bestes Provider/Modell aus Erfahrung (oder null)
pm.reinforce(id);                            // bei Nutzung verstärken (+ Konsolidierung)
pm.decay();                                  // Altern (beim App-Start)
pm.stats();
```

IPC-Kanäle: `pm-add`, `pm-recall`, `pm-record-outcome`, `pm-suggest-route`, `pm-reinforce`, `pm-remove`, `pm-stats`.

---

## 4. Einbinden in AgenticFlow

**1) main.js** (nach `registerHandlers(store)`):
```js
const { registerPerfectMemory } = require('./perfect-memory');
registerPerfectMemory(store, ipcMain);
```

**2) preload.js** (window.api):
```js
pm: {
  add:           p        => ipcRenderer.invoke('pm-add', p),
  recall:        (q, o)   => ipcRenderer.invoke('pm-recall', q, o),
  recordOutcome: p        => ipcRenderer.invoke('pm-record-outcome', p),
  suggestRoute:  (t, o)   => ipcRenderer.invoke('pm-suggest-route', t, o),
  reinforce:     id       => ipcRenderer.invoke('pm-reinforce', id),
  stats:         ()       => ipcRenderer.invoke('pm-stats'),
}
```

**3) An die Bubbles/Provider anbinden** — z.B. nach jeder Chat-Antwort:
```js
await window.api.pm.recordOutcome({
  task: userPrompt, bubbleId, provider, model, success: !response.error, durationMs
});
// vor dem Senden: Vorschlag holen
const tip = await window.api.pm.suggestRoute(userPrompt);
// tip = { provider, model, winRate, score } oder null
```

---

## 5. Ausbaustufen
1. **Jetzt:** Tag-/Stichwort-Recall + Decay/Boost/Konsolidierung (diese Datei).
2. **Dann:** Embeddings (über vorhandene Provider) → echte **semantische** Suche.
3. **Optional schwer:** `@claude-flow/memory` / **AgentDB** als npm-Abhängigkeit → HNSW-Vektorindex + RL.

---

*Prototyp ist bewusst klein (~200 Zeilen), offline-fähig, ohne native Module. Nicht automatisch in
`main.js` verdrahtet — Einbinden bewusst manuell (siehe Abschnitt 4), um laufende Arbeit nicht zu stören.*
