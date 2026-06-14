# Slack MCP Server

Slack-Bot-Integration für **AgenticFlow**. Exponiert die Slack Web API als MCP-Tools (stdio).

## 🔧 Setup

```bash
cd C:\Users\ModBot\AgenticFlow\MCP\Slack
npm install
copy .env.example .env   # Bot-Token eintragen
npm start
```

### Slack-Bot-Token besorgen
1. https://api.slack.com/apps → **Create New App** (From scratch).
2. **OAuth & Permissions** → unter *Bot Token Scopes* hinzufügen:
   `chat:write`, `channels:read`, `channels:history`, `groups:read`, `users:read`.
3. **Install to Workspace** → **Bot User OAuth Token** (`xoxb-...`) kopieren → `.env` als `SLACK_BOT_TOKEN`.
4. Den Bot in die gewünschten Channels einladen: `/invite @DeinBot`.

## 📡 Verfügbare Tools

| Tool | Beschreibung | Pflichtfelder |
|------|--------------|---------------|
| `post_message` | Nachricht in Channel senden (auch Thread) | `channel`, `text` |
| `get_channel_history` | Letzte Nachrichten eines Channels | `channel` |
| `list_channels` | Channels des Workspaces auflisten | – |
| `list_users` | Workspace-Mitglieder auflisten | – |
| `get_user_info` | Profil eines Users holen | `user` |
| `health_check` | API-Erreichbarkeit + Token prüfen | – |

Welche Tool-Gruppen aktiv sind, steuert `config.json` → `tools.*`.

## 🧪 Test

In Claude Code registrieren:
```bash
claude mcp add slack -- node "C:\Users\ModBot\AgenticFlow\MCP\Slack\mcp-server.js"
```

## 📖 Dateien
- `mcp-server.js` — Hauptserver (Tools, Handler, Health-Check)
- `config.json` — API-URL, Timeouts, aktive Tool-Gruppen
- `package.json` — Dependencies (`@slack/web-api`, MCP SDK)
- `.env.example` — Vorlage für `SLACK_BOT_TOKEN`

## 🛟 Troubleshooting
- **`not_in_channel`** → Bot mit `/invite @DeinBot` in den Channel einladen.
- **`missing_scope`** → fehlende Bot-Scopes in der App-Config ergänzen und neu installieren.
- **`invalid_auth`** → Token falsch/abgelaufen.
- **Doku:** https://api.slack.com/web
