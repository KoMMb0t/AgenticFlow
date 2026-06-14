#!/usr/bin/env node

/**
 * AgenticFlow MCP Server für Perplexity
 *
 * Startet einen Model Context Protocol Server, der Perplexity mit AgenticFlow verbindet.
 *
 * Alle Konnektoren, Agenten und Memory-Funktionen werden als MCP-Tools exponiert.
 * AgenticFlow läuft auf localhost:3001 und wird über HTTP angesprochen.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Konfiguration laden ──────────────────────────────────
let config = {};
try {
  const configPath = path.join(__dirname, 'config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.error('[MCP] Config loaded:', config.server.name);
} catch (err) {
  console.error('[MCP] Fehler beim Laden von config.json:', err.message);
  process.exit(1);
}

// Port-Auto-Erkennung: lies die tatsaechliche AgenticFlow-Adresse aus der Runtime-Datei,
// die der API-Server beim Start schreibt (MCP/_runtime/agentic-flow.json). Fallback = config.
function discoverBaseUrl() {
  try {
    const rt = path.join(__dirname, '..', '_runtime', 'agentic-flow.json');
    if (fs.existsSync(rt)) {
      const info = JSON.parse(fs.readFileSync(rt, 'utf8'));
      if (info && info.baseUrl) {
        console.error(`[MCP] AgenticFlow erkannt unter ${info.baseUrl} (aus Runtime-Datei)`);
        return info.baseUrl;
      }
    }
  } catch (e) { /* Fallback unten */ }
  return config.agentic_flow.base_url;
}

const AGENTIC_FLOW_URL = discoverBaseUrl();
const TIMEOUT = config.agentic_flow.timeout_ms;

// ── HTTP Client ──────────────────────────────────────────
const axiosClient = axios.create({
  baseURL: AGENTIC_FLOW_URL,
  timeout: TIMEOUT,
});

// Health Check
async function checkHealth() {
  try {
    await axiosClient.get('/health');
    return true;
  } catch (err) {
    console.warn('[MCP] AgenticFlow nicht erreichbar:', err.message);
    return false;
  }
}

// ── Tool-Generierung ─────────────────────────────────────
function generateTools() {
  const tools = [];

  // 1) Konnektor-Tools
  if (config.tools.connector_operations.enabled) {
    config.connectors.forEach(conn => {
      tools.push({
        name: `open_${conn.id}`,
        description: `Öffnet ${conn.name} in AgenticFlow`,
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['open', 'close'],
              description: 'open = öffnet Konnektor, close = schließt ihn',
            },
          },
          required: ['action'],
        },
      });
    });

    // Generic connector control
    tools.push({
      name: 'connector_control',
      description: 'Kontrolliert Konnektoren in AgenticFlow (öffnen/schließen)',
      inputSchema: {
        type: 'object',
        properties: {
          connector_id: {
            type: 'string',
            enum: config.connectors.map(c => c.id),
            description: 'Die ID des zu steuernden Konnektors',
          },
          action: {
            type: 'string',
            enum: ['open', 'close'],
            description: 'Aktion: "open" oder "close"',
          },
        },
        required: ['connector_id', 'action'],
      },
    });
  }

  // 2) Agenten-Tools
  if (config.tools.agent_execution.enabled) {
    config.agents.forEach(agent => {
      tools.push({
        name: `run_${agent.id}`,
        description: `Startet ${agent.name}-Agent: ${agent.description}`,
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Der Prompt / die Aufgabe für den Agenten',
            },
            system_prompt: {
              type: 'string',
              description: 'Optional: Custom System-Prompt',
            },
          },
          required: ['prompt'],
        },
      });
    });

    // Generic agent executor
    tools.push({
      name: 'execute_agent',
      description: 'Führt einen beliebigen Agenten in AgenticFlow aus',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            enum: config.agents.map(a => a.id),
            description: 'Die ID des Agenten',
          },
          prompt: {
            type: 'string',
            description: 'Der Prompt für den Agenten',
          },
          system_prompt: {
            type: 'string',
            description: 'Optional: Custom System-Prompt',
          },
        },
        required: ['agent_id', 'prompt'],
      },
    });
  }

  // 3) Memory-Tools
  if (config.tools.memory_operations.enabled) {
    tools.push({
      name: 'read_memory',
      description: 'Liest Perfect Memory aus AgenticFlow',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    });

    tools.push({
      name: 'write_memory',
      description: 'Schreibt neuen Eintrag zu Perfect Memory',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['interaction', 'insight', 'context', 'decision', 'learning'],
            description: 'Typ des Memory-Eintrags',
          },
          content: {
            type: 'string',
            description: 'Der zu speichernde Inhalt',
          },
        },
        required: ['type', 'content'],
      },
    });
  }

  // 4) Chat-Tools
  if (config.tools.chat_history.enabled) {
    tools.push({
      name: 'get_chat_history',
      description: 'Liest den Chat-Verlauf aus AgenticFlow',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Anzahl der letzten Nachrichten (default: 50)',
            default: 50,
          },
        },
      },
    });
  }

  // 5) System-Tools
  tools.push({
    name: 'list_connectors',
    description: 'Listet alle verfügbaren Konnektoren auf',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['cloud', 'dev', 'comms', 'tool', 'ai', 'all'],
          description: 'Filtere nach Kategorie',
          default: 'all',
        },
      },
    },
  });

  tools.push({
    name: 'list_agents',
    description: 'Listet alle verfügbaren Agenten auf',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  });

  tools.push({
    name: 'health_check',
    description: 'Prüft, ob AgenticFlow erreichbar ist',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  });

  return tools;
}

// ── Tool-Handler ─────────────────────────────────────────
async function handleToolCall(toolName, toolInput) {
  console.error(`[MCP] Tool aufgerufen: ${toolName}`, toolInput);

  try {
    // Health Check
    if (toolName === 'health_check') {
      const healthy = await checkHealth();
      return {
        type: 'text',
        text: healthy ? '✅ AgenticFlow ist erreichbar' : '❌ AgenticFlow nicht erreichbar',
      };
    }

    // List Connectors
    if (toolName === 'list_connectors') {
      const { category = 'all' } = toolInput;
      let connectors = config.connectors;
      if (category !== 'all') {
        connectors = connectors.filter(c => c.category === category);
      }
      return {
        type: 'text',
        text: JSON.stringify(connectors, null, 2),
      };
    }

    // List Agents
    if (toolName === 'list_agents') {
      return {
        type: 'text',
        text: JSON.stringify(config.agents, null, 2),
      };
    }

    // Connector Control
    if (toolName === 'connector_control') {
      const { connector_id, action } = toolInput;
      const endpoint = action === 'open'
        ? `/api/connectors/${connector_id}/open`
        : `/api/connectors/${connector_id}/close`;
      const response = await axiosClient.post(endpoint);
      return {
        type: 'text',
        text: `✅ ${connector_id} wurde ${action === 'open' ? 'geöffnet' : 'geschlossen'}`,
      };
    }

    // Generic Connector Open (run_<id> tools)
    if (toolName.startsWith('open_')) {
      const { action } = toolInput;
      const connectorId = toolName.replace('open_', '');
      const endpoint = action === 'close'
        ? `/api/connectors/${connectorId}/close`
        : `/api/connectors/${connectorId}/open`;
      await axiosClient.post(endpoint);
      return {
        type: 'text',
        text: `✅ ${connectorId} wurde ${action === 'open' ? 'geöffnet' : 'geschlossen'}`,
      };
    }

    // Execute Agent
    if (toolName === 'execute_agent' || toolName.startsWith('run_')) {
      const { agent_id, prompt, system_prompt } = toolName === 'execute_agent'
        ? toolInput
        : { agent_id: toolName.replace('run_', ''), ...toolInput };

      const response = await axiosClient.post(
        `/api/agents/${agent_id}/run`,
        { prompt, systemPrompt: system_prompt }
      );
      return {
        type: 'text',
        text: response.data.response || 'Agent execution erfolgreich',
      };
    }

    // Read Memory
    if (toolName === 'read_memory') {
      const response = await axiosClient.get('/api/memory');
      return {
        type: 'text',
        text: JSON.stringify(response.data.memory, null, 2),
      };
    }

    // Write Memory
    if (toolName === 'write_memory') {
      const { type, content } = toolInput;
      const response = await axiosClient.post('/api/memory', { type, content });
      return {
        type: 'text',
        text: `✅ Memory-Eintrag gespeichert: ${type}`,
      };
    }

    // Get Chat History
    if (toolName === 'get_chat_history') {
      const { limit = 50 } = toolInput;
      const response = await axiosClient.get('/api/chat');
      const history = response.data.chatHistory.slice(-limit);
      return {
        type: 'text',
        text: JSON.stringify(history, null, 2),
      };
    }

    return {
      type: 'text',
      text: `⚠️ Tool "${toolName}" nicht implementiert`,
    };
  } catch (error) {
    console.error(`[MCP] Fehler bei Tool ${toolName}:`, error.message);
    return {
      type: 'text',
      text: `❌ Fehler: ${error.message}`,
    };
  }
}

// ── MCP Server ───────────────────────────────────────────
const server = new Server(
  { name: 'AgenticFlow MCP Server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = generateTools();
  console.error(`[MCP] ${tools.length} Tools registriert`);
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: toolName, arguments: toolInput } = request.params;
  const result = await handleToolCall(toolName, toolInput || {});
  // MCP-Standard: Ergebnis muss als content-Array zurückkommen
  return { content: [result] };
});

server.onerror = (error) => {
  console.error('[MCP] Server-Fehler:', error);
};

process.on('SIGINT', () => {
  console.error('[MCP] Server herunterfahren...');
  process.exit(0);
});

// ── Start ────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Health check on startup
  const healthy = await checkHealth();
  console.error(
    `[MCP] Server gestartet. AgenticFlow: ${healthy ? '✅ erreichbar' : '⚠️ nicht erreichbar'}`
  );
}

main().catch(console.error);
