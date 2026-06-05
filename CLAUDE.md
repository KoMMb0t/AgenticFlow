# CLAUDE.md — AgenticFlow Projektkontext

## 🎯 Was ist das?
Electron Desktop App (Windows/Linux/Android) — Multi-Agent Hub mit Claude API, Cloud-Connectors, BLE-Login, Perfect Memory. **Kein Web-App**, aber mit Browser-Integration (BrowserViews pro Account isoliert).

## 📁 Repos
- AgenticFlow Desktop: https://github.com/KoMMb0t/AgenticFlow
- AgenticFlow Web (Base44): https://github.com/KoMMb0t/agenticflow-web
- KoMM Dashboard (Base44): https://github.com/KoMMb0t/komm-dashboard

## 🏗 Stack
- Electron 28 + electron-store + electron-builder
- @anthropic-ai/sdk (Claude streaming)
- node-fetch, PowerShell für BLE/Netzwerk
- React (Base44 Web Apps, separat)

## 📂 Dateistruktur (aktuell)
```
src/
├─ main.js              ← Electron Main Process (BrowserView mgmt, IPC handler)
├─ preload.js           ← contextBridge (window.api)
├─ ble.js               ← BLE/Bluetooth via PowerShell/PnP
├─ claude-api.js        ← Claude streaming, Agenten-Prompts, Memory CRUD
├─ index.html           ← ✅ NEU GESCHRIEBEN (v1.0 Layout)
├─ styles.css           ← ✅ NEU GESCHRIEBEN (v1.0 CSS)
├─ renderer.js          ← ⚠️ ALT → wird ersetzt durch Module unten
├─ renderer-old.js      ← Backup des alten renderers
│
│  ── NEUE MODULARE STRUKTUR (in Arbeit) ──
├─ renderer-utils.js    ← ✅ FERTIG — Helpers, APP_TEMPLATES, uuid, esc
├─ renderer-accounts.js ← ✅ FERTIG — Multi-Account Manager (AccountManager class)
├─ renderer-sidebar.js  ← ✅ FERTIG — LeftSidebarManager (Toggle, Render, Network)
├─ renderer-center.js   ← ❌ FEHLT NOCH
├─ renderer-memory.js   ← ❌ FEHLT NOCH
└─ renderer.js          ← ❌ NEU SCHREIBEN (Main init, alles zusammenführen)

assets/
└─ icon.ico             ← Oktopus-Icon (5 Größen)
```

## 🆕 Neue Struktur (v1.0 — in Arbeit)

### HTML-Layout (index.html)
```
┌─ HEADER ─────────────────────────────────────────────┐
│ [≡] ⚡AgenticFlow  [KI-Tabs: Home / AI-Agenten]  [≡] │
├─ LEFT (280px) ──┬─ CENTER ──────────┬─ RIGHT (360px) ┤
│ ☁ CLOUDS        │                   │ 🧠 Perfect     │
│  └ + Multi-Acc  │  Projektfenster   │    Memory      │
│ 📱 BROWSER      │  (Chat/Code)      │    Chat        │
│ 💬 CHANNELS     │                   │                │
│ 🔧 SERVICES     │  BrowserView      │ ── Buttons ─── │
│ ⭐ FAVORITES    │  slide-in für     │ [💾][📊][🔧]   │
│ 🕐 RECENT       │  Konnektoren      │                │
├─ ─ ─ ─ ─ ─ ─ ─ ┤                   │                │
│ 📡 NETZWERK     │                   │                │
│  WiFi / Geräte  │                   │                │
│  BLE (Pairing)  │                   │                │
│  [Netzgabe] tog │                   │                │
└─────────────────┴───────────────────┴────────────────┘
```

### Kern-Features

**Multi-Account:**
- Jeder Account = eigene `instanceId` + `partition` (isolierter BrowserView)
- Mehrere Google, Manus, GitHub etc. gleichzeitig offen
- AccountManager class in renderer-accounts.js
- Gespeichert in localStorage

**Left Sidebar Toggle (Konnektoren):**
- Klick auf App → öffnet slide-in BrowserView
- Klick nochmal → schließt
- Kein Reiter, kein Overlay

**Smart Sidebar Collapse:**
- Icons-only Mode wenn collapsed
- Toggle-Button oben links/rechts

**Favorites (#2):**
- Sternchen-Button auf App-Items
- Eigener "Favorites" Abschnitt oben in Sidebar

**Recent (#4):**
- Zuletzt verwendet (max 10)
- Eigener Abschnitt in Sidebar

**Header Tabs:**
- NUR KI-Agenten (ChatGPT, Gemini, Claude.ai etc.)
- NICHT Konnektoren

**Chat Input:**
- 🎤 Mikrofon-Button
- 🎙️ Sprachassistent-Button

## ✅ ERLEDIGT (2026-06-05, Details: deliverables/plan.md)
1. ✅ `renderer-center.js` — Projekt/Chat, Agent Tabs, Send-Logic (+ Provider-Umschalter Claude/OpenAI/Gemini)
2. ✅ `renderer-memory.js` — Perfect Memory Chat rechts
3. ✅ `renderer.js` — Main init, Module verdrahtet + `sendLayout()` (BrowserView-Bounds!)
4. ✅ `main.js` — add-connector akzeptiert Account-Objekte (instanceId/partition wiederverwendet)
5. ✅ Mikrofon/Sprachassistent im Chat-Input (Web Speech API)
6. ✅ BLE Code-Kopplung (6-stelliger Code im Pairing-Modal)
7. ✅ Network Access Toggle — blockt Requests via session.webRequest
8. ⏳ Auf GitHub pushen — bitte MANUELL via GitHub Desktop (nicht aus der Cowork-Sandbox committen!)

## ❌ NOCH OFFEN
- Echte OAuth-Flows pro Dienst (Auth-Menü merkt bisher nur die Methode)
- electron-builder Release-Build testen

## 🧠 Metaprompts (KI-Instanzen)
- Alle Metaprompts für orchestrierte KI-Instanzen stehen in **`METAPROMPTS.md`**
- Enthält: claw/OpenClaw (eingebaut) + ChatGPT, Gemini, Manus, Perplexity, Claude.ai, Grok
- **Stehende Regel (Nutzer-Wunsch, als Wissen gespeichert):**
  > „Schlag mir bitte Metaprompts für alle anderen KI-Instanzen vor während wir arbeiten."
  → Bei JEDER neuen KI-Anbindung / jedem neuen Agenten proaktiv einen passenden
    Metaprompt vorschlagen und in `METAPROMPTS.md` ergänzen.
- Basis-Gerüst abgeleitet vom Cowork-Umsetzungsagent (Lesen → Plan → schrittweise → Annahmen dokumentieren)
- Antwort-Protokoll wo möglich: **IAC-JSON** (performative: REQUEST/INFORM/PROPOSE/ACCEPT/REJECT)

## 📚 Dokumentation & Doc-Watch (für ALLE Chats + Cowork)
- **Lebende Doku:** `DOCUMENTATION.md` (Architektur, Ordnerstruktur, src-Module, REST-API
  `localhost:3001`, MCP-System, Setup, Konventionen). **Erst dort nachsehen.**
- **MCP-System:** Jeder Service = eigener Ordner unter `MCP/` (Perplexity ✅, GitHub/Notion/Slack 🟡).
  Neue Server bauen: `MCP/METAPROMPT-MCP-Builder.md`.
- **Doc-Watch-Workflow:** `tools/doc-watch.ps1` läuft regelmäßig (Scheduled Task „AgenticFlow-DocWatch",
  alle 30 Min), erkennt Repo-Änderungen und legt Task-Pakete in `MCP/Manus/tasks/` ab.
- **Schreibarbeit = Manus:** Die Doku-Erweiterung übernimmt **Manus** (Doc-Agent), nicht Claude.
  Rolle/Regeln: `MCP/Manus/MANUS-DOC-AGENT.md`. Claude liefert nur die Änderungs-Pakete.

## 🌐 Agenten-Zugang & Cloud (für claude.ai, Claude Code & andere)
> **Vollständiges Konzept + fertige Self-Service-Prompts:** `MCP/AGENT-ACCESS-CONCEPT.md`
- **AgenticFlow-API:** `http://localhost:<port>` — Port **nicht** fest annehmen, sondern aus
  `MCP/_runtime/agentic-flow.json` lesen (Auto-Port-Erkennung; Start 3001, sonst nächster freier).
- **Claude Code (lokal):** direkt per HTTP gegen die discovered `baseUrl`, oder MCP registrieren:
  `claude mcp add agenticflow -- node "C:\Users\ModBot\AgenticFlow\MCP\Perplexity\mcp-server.js"`.
- **claude.ai (Web):** kann **kein** localhost — entweder Custom Connector via Tunnel
  (`cloudflared tunnel --url http://localhost:3001`) **oder** datei-basiert über kDrive.
- **Cloud-Ablage:** Austausch-/Doc-Tasks **primär auf kDrive** (ENV `AGENTICFLOW_TASKS_DIR`),
  **Backups auf die anderen Clouds** (OneDrive …) via `tools/backup-tasks.ps1`
  (ENV `AGENTICFLOW_BACKUP_DIRS`, ";"-getrennt).
  > ⚠️ kDrive-Desktop-Client ist aktuell **nicht installiert** — bis dahin Primär = lokal, Backup = OneDrive.

## 🔑 Regeln
- API-Keys NIEMALS committen
- Commits: `feat:`, `fix:` mit kurzer deutscher Beschreibung
- Sprache: Deutsch für Kommunikation, Englisch für Code
- **Immer nach Änderungen auf GitHub pushen**
- **Metaprompts:** bei neuer KI-Instanz proaktiv Metaprompt vorschlagen (siehe METAPROMPTS.md)
- **Doku:** Code-Änderungen → `DOCUMENTATION.md` aktuell halten (via Doc-Watch → Manus, siehe oben)

## 🛠 App starten
```powershell
cd C:\Users\ModBot\AgenticFlow
node_modules\electron\dist\electron.exe . --disable-gpu
```

## 📋 Weitere Projekte
- `C:\Users\ModBot\agenticflow-web\`  — Base44 Web App (Projekt-Chat)
- `C:\Users\ModBot\komm-dashboard\`   — Base44 Dashboard (Konnektoren Overview)
