# AgenticFlow — Technische Dokumentation

> **Lebende Dokumentation.** Baseline von Claude erstellt; wird laufend durch den
> **Doc-Watch-Workflow** (`tools/doc-watch.ps1`) + **Manus** (Schreibarbeit) erweitert.
> Siehe `CLAUDE.md` → Abschnitt „Dokumentation & Doc-Watch".
>
> Stand: automatisch gepflegt · letzter manueller Baseline-Build durch Claude.

---

## 1. Überblick

**AgenticFlow** ist ein **Electron-Desktop-Hub** (Windows/Linux), der mehrere KI-Agenten,
Cloud-Konnektoren und ein „Perfect Memory" in einer 3-Panel-Oberfläche bündelt. Zusätzlich
exponiert die App eine lokale REST-API (`localhost:3001`) und ein modulares **MCP-System**,
über das externe Plattformen (z. B. Perplexity) AgenticFlow steuern können.

- **Typ:** Electron Desktop App (kein Web-App), mit isolierten BrowserViews pro Account
- **Sprache:** Deutsch (Kommunikation/Docs), Englisch (Code)
- **Owner:** KoMMb0t
- **Repo:** https://github.com/KoMMb0t/AgenticFlow

---

## 2. Architektur (High-Level)

```
┌───────────────────────────── Electron Main Process (src/main.js) ──────────────────────────────┐
│  electron-store (persistenter State)                                                            │
│  ├─ registerHandlers()  (claude-api.js)   ── Claude streaming, Agenten, Memory CRUD (IPC)       │
│  ├─ registerBleHandlers() (ble.js)        ── BLE/Bluetooth-Pairing via PowerShell               │
│  └─ startApiServer() (api-server.js)      ── Express REST-API auf localhost:3001  ◀────────┐    │
│                                                                                            │    │
│  BrowserWindow ── lädt src/index.html ── Renderer-Module (renderer-*.js)                   │    │
└────────────────────────────────────────────────────────────────────────────────────────── │ ───┘
                                                                                             │
   Perplexity / externe KI ──MCP(stdio)──▶ MCP/Perplexity/mcp-server.js ──HTTP(axios)────────┘
   (weitere: MCP/GitHub, MCP/Notion, MCP/Slack — je eigener Server)
```

**Datenfluss Perplexity → AgenticFlow:**
`Perplexity → MCP-Server (stdio) → HTTP localhost:3001 (api-server.js) → electron-store / Claude`

---

## 3. Ordnerstruktur

```
AgenticFlow/
├── CLAUDE.md                  ← Projektkontext + Regeln (für alle Chats/Cowork)
├── DOCUMENTATION.md           ← DIESE Datei (lebende Doku)
├── METAPROMPTS.md             ← Metaprompts für KI-Instanzen (ChatGPT, Gemini, Manus, …)
├── package.json               ← Electron-App Manifest + Dependencies
├── .gitignore                 ← ignoriert node_modules, .env, *API Keys*.txt, *.key, secrets/
├── AgenticLFlow API Keys.txt  ← LOKALE Secrets (per .gitignore NICHT im Repo)
│
├── src/                       ← App-Quellcode (Main + Renderer-Module)
├── assets/                    ← Icons (Oktopus icon.ico, png)
├── deliverables/              ← Build-/Liefer-Artefakte
├── tools/                     ← Wartungs-Skripte (doc-watch.ps1, Logs, State)
└── MCP/                       ← MCP-Server (1 Unterordner je Service) + Manus-Doc-Agent
    ├── METAPROMPT-MCP-Builder.md
    ├── Perplexity/   (✅ fertig, 13 Tools)
    ├── GitHub/       (🟡 6 Tools)
    ├── Notion/       (🟡 Boilerplate)
    ├── Slack/        (🟡 Boilerplate)
    └── Manus/        ← Doc-Agent-Metaprompt + Task-Inbox (tasks/)
```

---

## 4. Quellcode-Module (`src/`)

### Main Process
| Datei | Zweck |
|-------|-------|
| `main.js` | Electron Main: BrowserWindow/BrowserView-Verwaltung, IPC-Handler, lädt API-Server. Enthält `CONNECTOR_TEMPLATES` (links) + `RIGHT_TEMPLATES` (rechts, KI-Agenten). |
| `claude-api.js` | Anthropic SDK Bridge: Streaming, `AGENT_PROMPTS` (architect/researcher/coder/writer/analyst/memory), `MODELS` (Opus 4.8 / Sonnet 4.6 / Haiku 4.5), Memory-CRUD via IPC. |
| `ble.js` | BLE/Bluetooth-Pairing über PowerShell/PnP. |
| `api-server.js` | **Express REST-API (localhost:3001)** — siehe Abschnitt 5. |
| `preload.js` | `contextBridge` → exponiert `window.api` an den Renderer (sichere IPC-Brücke). |

### Renderer (UI)
| Datei | Zweck |
|-------|-------|
| `index.html` | Haupt-Layout (3 Panels + Header/Taskbar). |
| `renderer.js` | Init/Bootstrap, führt Module zusammen, IPC-Events. |
| `renderer-taskbar.js` | Header-Taskbar (Rollen-/KI-/MCP-Auswahl). |
| `renderer-auth.js` | Auth-System (OAuth / API-Key Flows). |
| `renderer-accounts.js` | Multi-Account-Manager (isolierte Partitions/BrowserViews). |
| `renderer-sidebar.js` | Linke Sidebar (Konnektoren, Toggle auf/zu, Netzwerk). |
| `renderer-center.js` | Mittleres Panel (Projekt/Chat, Agent-Tabs, Send-Logik). |
| `renderer-memory.js` | Rechtes Panel (Perfect-Memory-Chat). |
| `renderer-mcp.js` | **MCP-Manager** (Taskbar-Dropdown, Health-Checks, Kontext-Selektor) — siehe Abschnitt 6. |
| `renderer-keytools.js` | API-Key-Tools / Verwaltung. |
| `renderer-utils.js` | Helpers (uuid, esc, Templates). |
| `renderer-old.js`, `styles-old.css` | Legacy-Backup (alte Monolith-Version). |
| `styles.css` | Haupt-Styles (v1.0 Layout). |
| `styles-mcp.css` | MCP-spezifische Styles (Dropdown, Modal, Kontext-Selektor). |

> **Hinweis:** Die modulare Renderer-Struktur ist aktiv in Entwicklung (letzter Commit:
> „feat: Taskbar (Rollen/Agenten) + Auth-System"). Detail-Doku je Modul wird durch Manus ergänzt.

---

## 5. REST-API (`src/api-server.js`, Port 3001)

Wird beim App-Start automatisch geladen (`startApiServer(store, apiKey)` in `main.js`).
Greift direkt auf `electron-store` zu; für Agenten-Calls auf die Anthropic SDK.

| Methode | Endpoint | Zweck |
|---------|----------|-------|
| GET  | `/health` | Health-Check |
| GET  | `/api/connectors` | Konnektoren auflisten |
| POST | `/api/connectors/:id/open` | Konnektor öffnen (markiert `active`) |
| POST | `/api/connectors/:id/close` | Konnektor schließen |
| GET  | `/api/agents` | Agenten auflisten |
| POST | `/api/agents/:id/run` | Agent mit `{prompt, systemPrompt}` ausführen (inkl. Memory-Kontext) |
| GET  | `/api/memory` | Perfect Memory lesen |
| POST | `/api/memory` | Memory-Eintrag `{type, content}` schreiben |
| GET  | `/api/chat` | Chat-History lesen |

**State-Keys (electron-store):** `connectors`, `rightApps`, `perfectMemory`, `chatHistory`, `apiKeys`, …

---

## 6. MCP-System (`MCP/`)

Jeder Service ist ein **eigenständiger MCP-Server** in einem eigenen Unterordner — Regel:
*„Für jeden weiteren MCP-Server ein weiterer Ordner."*

**Einheitliche Struktur pro Server:**
```
MCP/<Service>/
├── mcp-server.js   ← @modelcontextprotocol/sdk (stdio), ES modules
├── config.json     ← Tool-/Service-Definitionen (NICHT im Code hardcoden)
├── package.json    ← "type":"module", Node 18+
├── README.md       ← Setup + Tools + Troubleshooting
└── .env.example    ← Secrets-Vorlage (GITHUB_TOKEN, NOTION_API_KEY, …)
```

| Server | Status | Tools (Auszug) |
|--------|--------|----------------|
| **Perplexity** | ✅ fertig | `list_connectors`, `connector_control`, `open_<id>`, `execute_agent`, `run_<id>`, `read_memory`, `write_memory`, `get_chat_history`, `health_check` (13 Tools) |
| **GitHub** | 🟡 6 Tools | `list_repos`, `get_repo_info`, `list_issues`, `create_issue`, `list_pulls`, `health_check` (braucht `GITHUB_TOKEN`) |
| **Notion** | 🟡 Boilerplate | package/config vorhanden, `mcp-server.js` offen |
| **Slack** | 🟡 Boilerplate | package/config vorhanden, `mcp-server.js` offen |

**Neue Server bauen:** Anleitung in `MCP/METAPROMPT-MCP-Builder.md` (für dedizierte Claude-Instanz).

---

## 7. Setup & Start

```powershell
# 1) AgenticFlow (inkl. API-Server auf :3001)
cd C:\Users\ModBot\AgenticFlow
npm install
npm start          # oder: node_modules\electron\dist\electron.exe . --disable-gpu

# 2) Perplexity-MCP (separates Terminal)
cd C:\Users\ModBot\AgenticFlow\MCP\Perplexity
npm install
npm start

# 3) In Perplexity: Settings → MCP → Add
#    Command: node C:\Users\ModBot\AgenticFlow\MCP\Perplexity\mcp-server.js
```

---

## 8. Konventionen & Regeln

- **API-Keys NIEMALS committen** (liegen in `AgenticLFlow API Keys.txt` / `.env`, beide gitignored).
- **Commits:** `feat:` / `fix:` mit kurzer **deutscher** Beschreibung.
- **Sprache:** Deutsch (Kommunikation/Docs), Englisch (Code).
- **Immer nach Änderungen auf GitHub pushen.**
- **Metaprompts:** bei neuer KI-Instanz proaktiv vorschlagen (siehe `METAPROMPTS.md`).
- **Config-driven:** Tool-/Service-Definitionen in `config.json`, nicht im Code.

---

## 9. Doc-Watch & Manus-Auslagerung

- **`tools/doc-watch.ps1`** prüft regelmäßig (Scheduled Task) das Repo auf Änderungen
  (Commits + uncommittete Dateien). Bei Änderungen erzeugt es ein **Task-Paket** unter
  `MCP/Manus/tasks/doc-task-<timestamp>.md`.
- **Manus** übernimmt die eigentliche **Schreibarbeit**: Es liest das Task-Paket + den
  Doc-Agent-Metaprompt (`MCP/Manus/MANUS-DOC-AGENT.md`) und erweitert **diese** Datei.
- So bleibt die Doku aktuell, ohne dass Claude jedes Mal selbst schreibt.

> Details & Limitierungen: siehe `MCP/Manus/MANUS-DOC-AGENT.md`.

---

## 10. TODO / Roadmap (aus CLAUDE.md gespiegelt)

- [ ] MCP-Dropdown final in `index.html`/`renderer.js` verdrahten (`renderer-mcp.js` einbinden)
- [ ] GitHub/Notion/Slack-Server vervollständigen
- [ ] Perplexity-MCP End-to-End testen
- [ ] BLE Code-Kopplung (6-stelliger Pairing-Code)
- [ ] Network-Access-Toggle real wirksam machen
- [ ] Mikrofon/Sprachassistent im Chat-Input
```
