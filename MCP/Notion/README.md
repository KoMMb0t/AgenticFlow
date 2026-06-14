# Notion MCP Server

Notion-Datenbank- & Seiten-Integration für **AgenticFlow**. Exponiert die Notion REST API als MCP-Tools (stdio).

## 🔧 Setup

```bash
cd C:\Users\ModBot\AgenticFlow\MCP\Notion
npm install
copy .env.example .env   # Token eintragen
npm start
```

### Notion-Token besorgen
1. https://www.notion.so/my-integrations → **New integration** anlegen.
2. **Internal Integration Token** kopieren → in `.env` als `NOTION_TOKEN`.
3. **Wichtig:** Die jeweilige Seite/Datenbank in Notion mit der Integration teilen
   (Seite → `•••` → *Connections* → deine Integration). Sonst sieht der Bot nichts.

## 📡 Verfügbare Tools

| Tool | Beschreibung | Pflichtfelder |
|------|--------------|---------------|
| `search_pages` | Seiten/Datenbanken nach Suchbegriff finden | – |
| `get_page` | Properties einer Seite holen | `page_id` |
| `create_page` | Neue Seite in einer Datenbank anlegen | `database_id`, `title` |
| `update_page` | Seite aktualisieren / archivieren | `page_id` |
| `query_database` | Datenbank-Einträge abfragen (Filter/Sort) | `database_id` |
| `get_database` | Schema einer Datenbank holen | `database_id` |
| `health_check` | API-Erreichbarkeit + Token prüfen | – |

Welche Tool-Gruppen aktiv sind, steuert `config.json` → `tools.*`.

## 🧪 Test

```bash
# Health-Check (zeigt Fehler, wenn Token fehlt/ungültig)
npm start   # Server läuft per stdio; in AgenticFlow / MCP-Client einbinden
```

In Claude Code registrieren:
```bash
claude mcp add notion -- node "C:\Users\ModBot\AgenticFlow\MCP\Notion\mcp-server.js"
```

## 📖 Dateien
- `mcp-server.js` — Hauptserver (Tools, Handler, Health-Check)
- `config.json` — API-Version, Timeouts, aktive Tool-Gruppen
- `package.json` — Dependencies (`@notionhq/client`, MCP SDK)
- `.env.example` — Vorlage für `NOTION_TOKEN`

## 🛟 Troubleshooting
- **`unauthorized` / leere Treffer** → Integration hat keinen Zugriff: Seite/DB mit der Integration teilen.
- **`Kein NOTION_TOKEN gesetzt`** → `.env` fehlt oder Variable nicht geladen.
- **Doku:** https://developers.notion.com/reference/intro
