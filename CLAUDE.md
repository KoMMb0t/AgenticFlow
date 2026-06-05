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

## ❌ NOCH ZU ERLEDIGEN
1. `renderer-center.js` — Projekt/Chat View, Agent Tabs, Send-Logic
2. `renderer-memory.js` — Perfect Memory Chat rechts
3. `renderer.js` — Main init, alle Module zusammenführen, IPC-Events
4. `main.js` anpassen — neue Partition-Logik für Multi-Account BrowserViews
5. Mikrofon/Sprachassistent in chat input
6. BLE Code-Kopplung (6-stelliger Code für Pairing)
7. Network Access Toggle → tatsächlich Proxy/Permission setzen
8. Alle neuen Dateien auf GitHub pushen

## 🔑 Regeln
- API-Keys NIEMALS committen
- Commits: `feat:`, `fix:` mit kurzer deutscher Beschreibung
- Sprache: Deutsch für Kommunikation, Englisch für Code
- **Immer nach Änderungen auf GitHub pushen**

## 🛠 App starten
```powershell
cd C:\Users\ModBot\AgenticFlow
node_modules\electron\dist\electron.exe . --disable-gpu
```

## 📋 Weitere Projekte
- `C:\Users\ModBot\agenticflow-web\`  — Base44 Web App (Projekt-Chat)
- `C:\Users\ModBot\komm-dashboard\`   — Base44 Dashboard (Konnektoren Overview)
