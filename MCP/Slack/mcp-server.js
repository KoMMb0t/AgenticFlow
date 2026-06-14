#!/usr/bin/env node
/**
 * Slack MCP Server für AgenticFlow
 *
 * Exponiert die Slack Web API als MCP-Tools.
 * Tools: post_message, list_channels, get_channel_history, list_users, get_user_info, health_check
 *
 * Auth: Bot-Token (xoxb-...) via ENV SLACK_BOT_TOKEN
 * Doku:  https://api.slack.com/web
 *
 * Benötigte Bot-Scopes (mind.):
 *   chat:write, channels:read, channels:history, groups:read, users:read
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebClient } from '@slack/web-api';
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

const TOKEN = process.env.SLACK_BOT_TOKEN;

// Slack Web-Client (offizielles SDK).
const slack = new WebClient(TOKEN, {
  timeout: config.slack.timeout_ms,
});

// ── Tool-Definitionen (abhängig von config.tools.*) ───────────
function generateTools() {
  const tools = [];

  if (config.tools.message_operations.enabled) {
    tools.push(
      {
        name: 'post_message',
        description: 'Sendet eine Nachricht in einen Slack-Channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel-ID (z. B. C012AB3CD) oder #channel-name' },
            text: { type: 'string', description: 'Nachrichtentext (Markdown/mrkdwn)' },
            thread_ts: { type: 'string', description: 'Optional: ts der Eltern-Nachricht für Thread-Antwort' },
          },
          required: ['channel', 'text'],
        },
      },
      {
        name: 'get_channel_history',
        description: 'Holt die letzten Nachrichten eines Channels',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel-ID' },
            limit: { type: 'number', description: 'Anzahl Nachrichten (Default 20, max 100)' },
          },
          required: ['channel'],
        },
      }
    );
  }

  if (config.tools.channel_operations.enabled) {
    tools.push({
      name: 'list_channels',
      description: 'Listet öffentliche/private Channels des Workspaces auf',
      inputSchema: {
        type: 'object',
        properties: {
          types: { type: 'string', description: 'Komma-Liste: public_channel,private_channel (Default public_channel)' },
          limit: { type: 'number', description: 'Anzahl (Default 50, max 200)' },
        },
      },
    });
  }

  if (config.tools.user_operations.enabled) {
    tools.push(
      {
        name: 'list_users',
        description: 'Listet die Mitglieder des Workspaces auf',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', description: 'Anzahl (Default 50, max 200)' } },
        },
      },
      {
        name: 'get_user_info',
        description: 'Holt Profil-Informationen zu einem Slack-User',
        inputSchema: {
          type: 'object',
          properties: { user: { type: 'string', description: 'User-ID (z. B. U012AB3CD)' } },
          required: ['user'],
        },
      }
    );
  }

  // Health-Check ist Pflicht (AgenticFlow-Standard)
  tools.push({
    name: 'health_check',
    description: 'Prüft, ob die Slack API erreichbar und der Bot-Token gültig ist',
    inputSchema: { type: 'object', properties: {} },
  });

  return tools;
}

// ── Tool-Handler ──────────────────────────────────────────────
async function handleToolCall(toolName, toolInput) {
  // Token-Gate für alle echten Operationen
  if (toolName !== 'health_check' && !TOKEN) {
    return { type: 'text', text: '❌ Kein SLACK_BOT_TOKEN gesetzt (siehe .env.example)' };
  }

  try {
    switch (toolName) {
      case 'health_check': {
        if (!TOKEN) return { type: 'text', text: '❌ Kein SLACK_BOT_TOKEN gesetzt (siehe .env.example)' };
        const res = await slack.auth.test();
        return { type: 'text', text: `✅ Slack erreichbar — Workspace: ${res.team}, Bot: ${res.user}` };
      }

      case 'post_message': {
        const { channel, text, thread_ts } = toolInput;
        const res = await slack.chat.postMessage({ channel, text, thread_ts });
        return { type: 'text', text: `✅ Nachricht gesendet (ts: ${res.ts}) in ${res.channel}` };
      }

      case 'get_channel_history': {
        const { channel, limit = 20 } = toolInput;
        const res = await slack.conversations.history({ channel, limit: Math.min(limit, 100) });
        const slim = (res.messages || []).map((m) => ({ ts: m.ts, user: m.user, text: m.text }));
        return { type: 'text', text: JSON.stringify(slim, null, 2) };
      }

      case 'list_channels': {
        const { types = 'public_channel', limit = 50 } = toolInput;
        const res = await slack.conversations.list({ types, limit: Math.min(limit, 200) });
        const slim = (res.channels || []).map((c) => ({
          id: c.id, name: c.name, is_private: c.is_private, num_members: c.num_members,
        }));
        return { type: 'text', text: JSON.stringify(slim, null, 2) };
      }

      case 'list_users': {
        const { limit = 50 } = toolInput;
        const res = await slack.users.list({ limit: Math.min(limit, 200) });
        const slim = (res.members || [])
          .filter((u) => !u.deleted)
          .map((u) => ({ id: u.id, name: u.name, real_name: u.real_name, is_bot: u.is_bot }));
        return { type: 'text', text: JSON.stringify(slim, null, 2) };
      }

      case 'get_user_info': {
        const { user } = toolInput;
        const res = await slack.users.info({ user });
        return { type: 'text', text: JSON.stringify(res.user, null, 2) };
      }

      default:
        return { type: 'text', text: `⚠️ Tool "${toolName}" nicht implementiert` };
    }
  } catch (error) {
    // Slack-SDK packt API-Fehler in error.data.error
    const msg = error?.data?.error || error.message;
    console.error(`[MCP] Fehler in ${toolName}: ${msg}`);
    return { type: 'text', text: `❌ ${msg}` };
  }
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
console.error('[MCP] Slack Server gestartet (benötigt SLACK_BOT_TOKEN env var)');
