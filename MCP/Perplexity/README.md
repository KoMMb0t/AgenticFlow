# AgenticFlow MCP Server für Perplexity

Ein Model Context Protocol (MCP) Server, der **Perplexity.ai** mit deiner lokalen **AgenticFlow**-App verbindet.

## Was macht dieser Server?

Perplexity kann über diesen Server:
- ✅ **Konnektoren öffnen/schließen** (Google Drive, GitHub, Slack, etc.)
- ✅ **Agenten ausführen** (Architect, Coder, Researcher, Writer, etc.)
- ✅ **Perfect Memory lesen/schreiben** (Kontextgedächtnis)
- ✅ **Chat-Verlauf abrufen**

Alles **lokal**, ohne externe APIs.

---

## Installation

### 1) Dependencies installieren

```bash
cd C:\Users\ModBot\AgenticFlow\MCP\Perplexity
npm install
```

### 2) AgenticFlow API muss laufen

Stelle sicher, dass AgenticFlow läuft (mit eingebautem API-Server auf `localhost:3001`):

```bash
cd C:\Users\ModBot\AgenticFlow
npm start
```

### 3) MCP-Server starten

In einem **separaten Terminal**:

```bash
cd C:\Users\ModBot\AgenticFlow\MCP\Perplexity
npm start
```

Ausgabe sollte so aussehen:
```
[MCP] Config loaded: AgenticFlow MCP Server
[MCP] Server gestartet. AgenticFlow: ✅ erreichbar
```

---

## Verbindung zu Perplexity

### Option A: Lokal (du nutzt den Server selbst)

1. Öffne Perplexity.ai im Browser
2. **Claude Code / Settings** → **MCP Servers**
3. Neue Verbindung hinzufügen:
   - **Name:** AgenticFlow
   - **Befehl:** `node C:\Users\ModBot\AgenticFlow\MCP\Perplexity\mcp-server.js`
   - **Starten:** Klick auf "Test"

### Option B: Remote via Tunnel (für später)

Falls du den Server auch remote/öffentlich nutzbar machen willst:

```bash
# Tunnel zu localhost:3001 (AgenticFlow API)
cloudflared tunnel --url http://localhost:3001

# Dann nutze die öffentliche URL in der MCP-Config
```

---

## Verfügbare Tools

### Konnektoren
```
open_google-drive, open_github, open_gmail, open_slack, open_notion, ...
```

### Agenten
```
run_architect    → Orchestriert Aufgaben
run_coder        → Schreibt & debuggt Code
run_researcher   → Recherchiert Infos
run_writer       → Formuliert Texte
run_analyst      → Analysiert Daten
```

### Memory
```
read_memory      → Liest Perfect Memory
write_memory     → Schreibt neue Einträge
```

### System
```
list_connectors  → Alle Konnektoren
list_agents      → Alle Agenten
health_check     → Status von AgenticFlow
```

---

## Beispiel-Prompts für Perplexity

```
"Öffne GitHub und den Coder-Agenten, dann schreib mir eine Funktion für X"

"Nutze den Architect, um diese Aufgabe zu zerlegen, speicher das in Memory"

"Was ist in meiner Perfect Memory gespeichert?"
```

---

## Architektur

```
Perplexity (Browser)
    ↓ MCP Protocol
MCP Server (mcp-server.js)
    ↓ HTTP (axios)
AgenticFlow API (localhost:3001)
    ↓ IPC
AgenticFlow (Electron App)
```

---

## Troubleshooting

### "AgenticFlow nicht erreichbar"
- Ist AgenticFlow laufen? (`npm start` im AgenticFlow-Ordner)
- Läuft auf Port 3001? (Prüfe: `curl http://localhost:3001/health`)

### MCP-Server startet nicht
- Node.js installiert? (`node --version`)
- Dependencies vorhanden? (`npm install`)
- Fehler in console? Kopiere sie und pinne sie in AgenticFlow CLAUDE.md

### Konnektor öffnet nicht
- Ist der Konnektor-ID korrekt?
- Siehst du ihn in `list_connectors`?

---

## Für Entwickler

### Neue Konnektoren hinzufügen

Bearbeite `config.json`:

```json
{
  "id": "my-service",
  "name": "My Service",
  "category": "tool",
  "icon": "🔧"
}
```

Server lädt automatisch neu — keine Code-Änderung nötig!

### Neue Agenten hinzufügen

Gleich wie Konnektoren — in `config.json` → `agents` Array.

### Custom Tool hinzufügen

In `mcp-server.js`, Funktion `generateTools()`:

```javascript
tools.push({
  name: 'my_custom_tool',
  description: 'Was es macht',
  inputSchema: { /* JSON Schema */ },
});

// Dann in handleToolCall():
if (toolName === 'my_custom_tool') {
  // Implementierung
}
```

---

## Lizenz

MIT © KoMMb0t / AgenticFlow
