# Zugang zu AgenticFlow für KI-Agenten — Konzept & Self-Service-Prompts

Dieses Dokument beschreibt, **wie sich beliebige KI-Agenten selbst Zugang zu AgenticFlow
verschaffen** — lokal (Claude Code), web-basiert (claude.ai) oder über MCP/Cloud (Perplexity,
Manus, …). Es ist die Referenz für „wie kommt Agent X an AgenticFlow ran".

---

## 1. Was AgenticFlow bereitstellt

| Kanal | Adresse | Für wen |
|-------|---------|---------|
| **REST-API** | `http://localhost:<port>` (Start 3001, **Auto-Port**) | Alles, was lokal HTTP sprechen kann |
| **Runtime-Discovery** | `MCP/_runtime/agentic-flow.json` | Zum Finden des **echten** Ports |
| **MCP-Server** | `MCP/<Service>/mcp-server.js` (stdio) | MCP-Clients (Perplexity, Claude Code, …) |
| **Cloud-Tasks** | kDrive-Ordner (ENV `AGENTICFLOW_TASKS_DIR`) | Datei-basierter Austausch (Manus, claude.ai, andere Geräte) |

### Port-Discovery (WICHTIG)
Der API-Server kann auf einem anderen Port als 3001 laufen (Auto-Erkennung). **Immer zuerst die
Runtime-Datei lesen**, statt 3001 fest anzunehmen:

```json
// MCP/_runtime/agentic-flow.json
{ "service": "AgenticFlow", "port": 3001, "baseUrl": "http://localhost:3001", "pid": 12345, "updatedAt": "..." }
```

PowerShell:
```powershell
$rt = "C:\Users\ModBot\AgenticFlow\MCP\_runtime\agentic-flow.json"
$base = if (Test-Path $rt) { (Get-Content $rt -Raw | ConvertFrom-Json).baseUrl } else { "http://localhost:3001" }
Invoke-RestMethod "$base/health"
```

---

## 2. Zugangs-Matrix pro Agent

### 🖥️ Claude Code (CLI, lokal auf dem PC)
**Hat Shell-Zugriff → einfachster Fall.**
- **Direkt:** Port aus Runtime-Datei lesen, dann `Invoke-RestMethod`/`curl` gegen die API.
- **Oder MCP:** lokalen MCP-Server registrieren:
  ```bash
  claude mcp add agenticflow -- node "C:\Users\ModBot\AgenticFlow\MCP\Perplexity\mcp-server.js"
  ```
- Voraussetzung: AgenticFlow läuft (`npm start`).

### 🌐 claude.ai (Web / Desktop-App)
**Kann KEIN `localhost` auf deinem PC erreichen** (läuft in der Cloud). Zwei Wege:
- **(a) Custom Connector (MCP über HTTPS):** API/MCP per Tunnel öffentlich machen, dann in
  claude.ai unter *Einstellungen → Connectors* als Custom Connector eintragen:
  ```bash
  cloudflared tunnel --url http://localhost:3001
  # -> https://<zufall>.trycloudflare.com  als Connector-URL verwenden
  ```
- **(b) Über kDrive (datei-basiert):** claude.ai mit kDrive/Nextcloud verbinden und die
  Task-Dateien in `AGENTICFLOW_TASKS_DIR` lesen/schreiben (kein Tunnel nötig, aber nur Dateiaustausch).

### 🔎 Perplexity / andere MCP-Clients
- Lokal: MCP-Server per stdio starten (`MCP/Perplexity/mcp-server.js`) und in den Client eintragen.
- Remote: gleicher Tunnel-Weg wie claude.ai (a).

### 🤖 Manus / weitere Agenten
- **Datei-basiert über kDrive:** Tasks liegen im kDrive-Ordner → von überall erreichbar.
- Optional API (falls Manus-Endpoint vorhanden): siehe `MCP/Manus/`.

---

## 3. Self-Service-Prompts (zum Einfügen in den jeweiligen Agenten)

### Prompt für **Claude Code** (lokal)
```
Verschaff dir Zugang zu AgenticFlow:
1. Lies C:\Users\ModBot\AgenticFlow\MCP\_runtime\agentic-flow.json und nimm baseUrl
   (Fallback http://localhost:3001).
2. Prüfe GET {baseUrl}/health. Wenn nicht erreichbar: starte AgenticFlow
   (cd C:\Users\ModBot\AgenticFlow; npm start) und warte auf /health.
3. Danach stehen dir zur Verfügung:
   GET  {baseUrl}/api/connectors | POST {baseUrl}/api/connectors/:id/open|close
   GET  {baseUrl}/api/agents     | POST {baseUrl}/api/agents/:id/run {prompt}
   GET/POST {baseUrl}/api/memory | GET {baseUrl}/api/chat
Antworte auf Deutsch, halte dich an C:\Users\ModBot\AgenticFlow\CLAUDE.md.
```

### Prompt für **claude.ai** (Web)
```
Du kannst meinen lokalen AgenticFlow NICHT direkt über localhost erreichen.
Nutze einen dieser Wege:
- Wenn ein Custom Connector "AgenticFlow" (Tunnel-URL) eingerichtet ist: nutze dessen Tools.
- Sonst arbeite datei-basiert über kDrive: lies/schreibe Task-Dateien im Ordner
  "AgenticFlow-Tasks" (kDrive). Format & Regeln: siehe MANUS-DOC-AGENT.md.
Frag mich nach der Connector-URL bzw. nach kDrive-Freigabe, falls nicht vorhanden.
```

### Prompt für **beliebigen Agenten** (generisch)
```
Ziel: Zugang zu AgenticFlow. Erkenne deinen Kanal:
- Hast du Shell/HTTP zu localhost? -> lies MCP/_runtime/agentic-flow.json, nutze {baseUrl}/health + /api/*.
- Bist du in der Cloud ohne localhost? -> nutze den Custom Connector (Tunnel) ODER
  den geteilten kDrive-Task-Ordner (datei-basiert).
- Bist du MCP-Client? -> registriere MCP/<Service>/mcp-server.js (stdio) oder die Tunnel-URL.
Lies immer zuerst CLAUDE.md + DOCUMENTATION.md im AgenticFlow-Repo.
```

---

## 4. Sicherheit

- **Lokale API ist ungesichert** (nur localhost). Bei Tunnel/öffentlich: **Auth/Token vorschalten**
  (z. B. Header-Token) und Tunnel nur bei Bedarf laufen lassen.
- **Keine Secrets** in Tasks/Doku schreiben. API-Keys bleiben in `.env` / `*API Keys*.txt` (gitignored).
- kDrive-Ordner nur mit vertrauenswürdigen Agenten teilen.

---

## 5. Status & Verweise
- Port-Auto-Erkennung: `src/api-server.js` → schreibt `MCP/_runtime/agentic-flow.json`
- Discovery-Beispiel: `MCP/Perplexity/mcp-server.js` (`discoverBaseUrl()`)
- Cloud-Tasks: `tools/doc-watch.ps1` (`-TasksDir` / ENV `AGENTICFLOW_TASKS_DIR`) → kDrive
- Doku: `DOCUMENTATION.md` · Regeln: `CLAUDE.md` · Manus-Rolle: `MCP/Manus/MANUS-DOC-AGENT.md`
```
