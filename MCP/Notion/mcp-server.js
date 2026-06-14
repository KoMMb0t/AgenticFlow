#!/usr/bin/env node
/**
 * Notion MCP Server für AgenticFlow
 *
 * Exponiert die Notion REST API als MCP-Tools.
 * Tools: search_pages, get_page, query_database, create_page, update_page, health_check
 *
 * Auth: Bearer-Token (Internal Integration Token) via ENV NOTION_TOKEN
 * Doku:  https://developers.notion.com/reference/intro
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@notionhq/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config laden ──────────────────────────────────────────────
let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (err) {
  console.error('[MCP] Config-Fehler:', err.message);
  process.exit(1);
}

const TOKEN = process.env.NOTION_TOKEN;

// Notion-Client (offizielles SDK). Ohne Token starten wir trotzdem,
// damit health_check eine klare Fehlermeldung liefern kann.
const notion = new Client({
  auth: TOKEN,
  notionVersion: config.notion.api_version,
  timeoutMs: config.notion.timeout_ms,
});

// ── Tool-Definitionen (abhängig von config.tools.*) ───────────
function generateTools() {
  const tools = [];

  if (config.tools.search_operations.enabled) {
    tools.push({
      name: 'search_pages',
      description: 'Durchsucht Notion nach Seiten/Datenbanken anhand eines Suchbegriffs',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Suchbegriff (leer = alle zugänglichen Objekte)' },
          filter: { type: 'string', enum: ['page', 'database'], description: 'Optional: nur Seiten oder nur Datenbanken' },
        },
      },
    });
  }

  if (config.tools.page_operations.enabled) {
    tools.push(
      {
        name: 'get_page',
        description: 'Holt die Eigenschaften (Properties) einer Notion-Seite',
        inputSchema: {
          type: 'object',
          properties: { page_id: { type: 'string', description: 'Notion Page-ID' } },
          required: ['page_id'],
        },
      },
      {
        name: 'create_page',
        description: 'Erstellt eine neue Seite in einer Datenbank (Parent = Datenbank)',
        inputSchema: {
          type: 'object',
          properties: {
            database_id: { type: 'string', description: 'Ziel-Datenbank-ID' },
            title: { type: 'string', description: 'Titel der neuen Seite' },
            properties: { type: 'object', description: 'Optional: weitere Properties als Notion-Property-Objekt' },
          },
          required: ['database_id', 'title'],
        },
      },
      {
        name: 'update_page',
        description: 'Aktualisiert Properties einer bestehenden Seite oder archiviert sie',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: { type: 'string', description: 'Notion Page-ID' },
            properties: { type: 'object', description: 'Zu ändernde Properties (Notion-Property-Objekt)' },
            archived: { type: 'boolean', description: 'true = Seite archivieren/löschen' },
          },
          required: ['page_id'],
        },
      }
    );
  }

  if (config.tools.database_operations.enabled) {
    tools.push(
      {
        name: 'query_database',
        description: 'Fragt Einträge einer Notion-Datenbank ab (mit optionalem Filter/Sortierung)',
        inputSchema: {
          type: 'object',
          properties: {
            database_id: { type: 'string', description: 'Notion Database-ID' },
            filter: { type: 'object', description: 'Optional: Notion-Filter-Objekt' },
            sorts: { type: 'array', description: 'Optional: Notion-Sorts-Array' },
            page_size: { type: 'number', description: 'Max. Anzahl Ergebnisse (Default 25)' },
          },
          required: ['database_id'],
        },
      },
      {
        name: 'get_database',
        description: 'Holt das Schema (Properties) einer Notion-Datenbank',
        inputSchema: {
          type: 'object',
          properties: { database_id: { type: 'string', description: 'Notion Database-ID' } },
          required: ['database_id'],
        },
      }
    );
  }

  // Health-Check ist Pflicht (AgenticFlow-Standard)
  tools.push({
    name: 'health_check',
    description: 'Prüft, ob die Notion API erreichbar und der Token gültig ist',
    inputSchema: { type: 'object', properties: {} },
  });

  return tools;
}

// ── Tool-Handler ──────────────────────────────────────────────
async function handleToolCall(toolName, toolInput) {
  // Token-Gate für alle echten Operationen
  if (toolName !== 'health_check' && !TOKEN) {
    return { type: 'text', text: '❌ Kein NOTION_TOKEN gesetzt (siehe .env.example)' };
  }

  try {
    switch (toolName) {
      case 'health_check': {
        if (!TOKEN) return { type: 'text', text: '❌ Kein NOTION_TOKEN gesetzt (siehe .env.example)' };
        const me = await notion.users.me({});
        return { type: 'text', text: `✅ Notion API erreichbar — Integration: ${me.name || me.id}` };
      }

      case 'search_pages': {
        const { query = '', filter } = toolInput;
        const params = { query };
        if (filter) params.filter = { property: 'object', value: filter };
        const res = await notion.search(params);
        const slim = res.results.slice(0, 10).map((r) => ({
          id: r.id,
          object: r.object,
          title: extractTitle(r),
          url: r.url,
        }));
        return { type: 'text', text: JSON.stringify(slim, null, 2) };
      }

      case 'get_page': {
        const { page_id } = toolInput;
        const res = await notion.pages.retrieve({ page_id });
        return { type: 'text', text: JSON.stringify(res, null, 2) };
      }

      case 'create_page': {
        const { database_id, title, properties = {} } = toolInput;
        // Standard-Titel-Property "Name" + ggf. weitere Properties mergen
        const props = {
          Name: { title: [{ text: { content: title } }] },
          ...properties,
        };
        const res = await notion.pages.create({ parent: { database_id }, properties: props });
        return { type: 'text', text: `✅ Seite erstellt: ${res.url}` };
      }

      case 'update_page': {
        const { page_id, properties, archived } = toolInput;
        const payload = { page_id };
        if (properties) payload.properties = properties;
        if (typeof archived === 'boolean') payload.archived = archived;
        const res = await notion.pages.update(payload);
        return { type: 'text', text: `✅ Seite aktualisiert: ${res.url || page_id}` };
      }

      case 'query_database': {
        const { database_id, filter, sorts, page_size = 25 } = toolInput;
        const params = { database_id, page_size };
        if (filter) params.filter = filter;
        if (sorts) params.sorts = sorts;
        const res = await notion.databases.query(params);
        const slim = res.results.map((r) => ({ id: r.id, title: extractTitle(r), url: r.url }));
        return { type: 'text', text: JSON.stringify(slim, null, 2) };
      }

      case 'get_database': {
        const { database_id } = toolInput;
        const res = await notion.databases.retrieve({ database_id });
        return { type: 'text', text: JSON.stringify(res, null, 2) };
      }

      default:
        return { type: 'text', text: `⚠️ Tool "${toolName}" nicht implementiert` };
    }
  } catch (error) {
    console.error(`[MCP] Fehler in ${toolName}: ${error.message}`);
    return { type: 'text', text: `❌ ${error.message}` };
  }
}

// Hilfsfunktion: Titel aus einem Notion-Objekt extrahieren (Seite oder DB)
function extractTitle(obj) {
  try {
    if (obj.object === 'database' && Array.isArray(obj.title)) {
      return obj.title.map((t) => t.plain_text).join('') || '(ohne Titel)';
    }
    const props = obj.properties || {};
    for (const key of Object.keys(props)) {
      const p = props[key];
      if (p.type === 'title' && Array.isArray(p.title)) {
        return p.title.map((t) => t.plain_text).join('') || '(ohne Titel)';
      }
    }
  } catch (_) { /* ignorieren */ }
  return '(ohne Titel)';
}

// ── Server-Setup ──────────────────────────────────────────────
const server = new Server(
  { name: config.server.name, version: config.server.version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: generateTools() }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await handleToolCall(name, args || {});
  // MCP-Standard: Ergebnis muss als content-Array zurückkommen
  return { content: [result] };
});

server.onerror = (error) => console.error('[MCP] Error:', error);
process.on('SIGINT', () => { console.error('[MCP] Shutdown'); process.exit(0); });

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
console.error('[MCP] Notion Server gestartet (benötigt NOTION_TOKEN env var)');
