#!/usr/bin/env node
/**
 * GitHub MCP Server für AgenticFlow
 *
 * Exponiert GitHub REST API als MCP-Tools
 * Tools: list_repos, create_issue, list_pulls, merge_pr, etc.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (err) {
  console.error('[MCP] Config error:', err.message);
  process.exit(1);
}

const GITHUB_API = config.github.api_url;
const TOKEN = process.env.GITHUB_TOKEN;

const client = axios.create({
  baseURL: GITHUB_API,
  timeout: config.github.timeout_ms,
  headers: TOKEN ? { 'Authorization': `token ${TOKEN}` } : {},
});

function generateTools() {
  const tools = [];

  if (config.tools.repository_operations.enabled) {
    tools.push(
      {
        name: 'list_repos',
        description: 'Listet deine GitHub-Repositories auf',
        inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['all', 'owner', 'public', 'private'] } } },
      },
      {
        name: 'get_repo_info',
        description: 'Holt Informationen zu einem Repository',
        inputSchema: { type: 'object', properties: { repo: { type: 'string', description: 'owner/repo format' } }, required: ['repo'] },
      }
    );
  }

  if (config.tools.issue_operations.enabled) {
    tools.push(
      {
        name: 'list_issues',
        description: 'Listet Issues in einem Repository auf',
        inputSchema: { type: 'object', properties: { repo: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed', 'all'] } }, required: ['repo'] },
      },
      {
        name: 'create_issue',
        description: 'Erstellt ein neues Issue',
        inputSchema: { type: 'object', properties: { repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } }, required: ['repo', 'title'] },
      }
    );
  }

  if (config.tools.pull_request_operations.enabled) {
    tools.push(
      {
        name: 'list_pulls',
        description: 'Listet Pull Requests auf',
        inputSchema: { type: 'object', properties: { repo: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed', 'all'] } }, required: ['repo'] },
      }
    );
  }

  tools.push({
    name: 'health_check',
    description: 'Prüft GitHub API-Erreichbarkeit',
    inputSchema: { type: 'object', properties: {} },
  });

  return tools;
}

async function handleToolCall(toolName, toolInput) {
  try {
    if (toolName === 'health_check') {
      await client.get('/zen');
      return { type: 'text', text: '✅ GitHub API erreichbar' };
    }

    if (toolName === 'list_repos') {
      const { type = 'all' } = toolInput;
      const response = await client.get('/user/repos', { params: { type } });
      return { type: 'text', text: JSON.stringify(response.data.slice(0, 10), null, 2) };
    }

    if (toolName === 'get_repo_info') {
      const { repo } = toolInput;
      const response = await client.get(`/repos/${repo}`);
      return { type: 'text', text: JSON.stringify(response.data, null, 2) };
    }

    if (toolName === 'list_issues') {
      const { repo, state = 'open' } = toolInput;
      const response = await client.get(`/repos/${repo}/issues`, { params: { state } });
      return { type: 'text', text: JSON.stringify(response.data.slice(0, 10), null, 2) };
    }

    if (toolName === 'create_issue') {
      if (!TOKEN) return { type: 'text', text: '❌ Kein GITHUB_TOKEN gesetzt' };
      const { repo, title, body } = toolInput;
      const response = await client.post(`/repos/${repo}/issues`, { title, body });
      return { type: 'text', text: `✅ Issue erstellt: ${response.data.html_url}` };
    }

    if (toolName === 'list_pulls') {
      const { repo, state = 'open' } = toolInput;
      const response = await client.get(`/repos/${repo}/pulls`, { params: { state } });
      return { type: 'text', text: JSON.stringify(response.data.slice(0, 10), null, 2) };
    }

    return { type: 'text', text: `⚠️ Tool "${toolName}" nicht implementiert` };
  } catch (error) {
    return { type: 'text', text: `❌ Fehler: ${error.message}` };
  }
}

const server = new Server(
  { name: 'GitHub MCP Server', version: '1.0.0' },
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
console.error('[MCP] GitHub Server started (require GITHUB_TOKEN env var)');
