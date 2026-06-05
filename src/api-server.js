/**
 * AgenticFlow API Server
 * Startet einen Express-Server mit MCP-Endpoints
 * -> Perplexity kann zu localhost:3001 sprechen und AgenticFlow steuern
 */

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

module.exports = function startApiServer(store, apiKey) {
  const app = express();
  app.use(bodyParser.json());

  // Lazy-load Anthropic client (nur wenn API-Key vorhanden)
  let client = null;
  function getClient() {
    if (!client) {
      if (!apiKey) throw new Error('Kein Claude API-Key vorhanden');
      const Anthropic = require('@anthropic-ai/sdk');
      client = new Anthropic({ apiKey });
    }
    return client;
  }

  // ── Helper: Store-Zugriff ──────────────────────────────
  function getConnectors() {
    return store.get('connectors') || [];
  }

  function setConnectors(connectors) {
    store.set('connectors', connectors);
  }

  function getRightApps() {
    return store.get('rightApps') || [];
  }

  function setRightApps(apps) {
    store.set('rightApps', apps);
  }

  function getMemory() {
    return store.get('perfectMemory') || [];
  }

  function setMemory(entries) {
    store.set('perfectMemory', entries);
  }

  function getChatHistory() {
    return store.get('chatHistory') || [];
  }

  function setChatHistory(history) {
    store.set('chatHistory', history);
  }

  // ── ENDPOINTS ──────────────────────────────────────────

  // 1) Konnektoren auflisten
  app.get('/api/connectors', (req, res) => {
    res.json({ connectors: getConnectors() });
  });

  // 2) Konnektor öffnen (slide-in)
  app.post('/api/connectors/:id/open', (req, res) => {
    const { id } = req.params;
    const connectors = getConnectors();
    const connector = connectors.find(c => c.id === id);

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    if (!connector.active) {
      connector.active = true;
      setConnectors(connectors);
    }

    res.json({ success: true, connector });
  });

  // 3) Konnektor schließen
  app.post('/api/connectors/:id/close', (req, res) => {
    const { id } = req.params;
    const connectors = getConnectors();
    const connector = connectors.find(c => c.id === id);

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    connector.active = false;
    setConnectors(connectors);
    res.json({ success: true });
  });

  // 4) Agenten auflisten
  app.get('/api/agents', (req, res) => {
    res.json({ agents: getRightApps() });
  });

  // 5) Agent starten (Claude API Call mit Memory)
  app.post('/api/agents/:id/run', async (req, res) => {
    const { id } = req.params;
    const { prompt, systemPrompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt required' });
    }

    try {
      const memory = getMemory();
      const memoryContext = memory
        .map(m => `[${m.timestamp}] ${m.type}: ${m.content}`)
        .join('\n');

      const fullSystemPrompt = `${systemPrompt || 'Du bist ein hilfreiches KI-Assistentsystem'}

Perfect Memory (Kontext):
${memoryContext || '(leer)'}`;

      // Rufe Claude API auf
      const claudeClient = getClient();
      const response = await claudeClient.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: fullSystemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const assistantMsg = response.content[0]?.text || '';

      // Speichere in Chat-History und Memory
      const chatHistory = getChatHistory();
      chatHistory.push({
        timestamp: new Date().toISOString(),
        role: 'user',
        content: prompt,
        agentId: id,
      });
      chatHistory.push({
        timestamp: new Date().toISOString(),
        role: 'assistant',
        content: assistantMsg,
        agentId: id,
      });
      setChatHistory(chatHistory);

      // Auto-Memory: Wichtige Erkenntnisse speichern
      const memory_entry = {
        timestamp: new Date().toISOString(),
        type: 'interaction',
        content: `Agent ${id}: ${prompt.slice(0, 100)}... → ${assistantMsg.slice(0, 100)}...`,
      };
      getMemory().push(memory_entry);
      setMemory(getMemory());

      res.json({ success: true, response: assistantMsg, agentId: id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 6) Perfect Memory auslesen
  app.get('/api/memory', (req, res) => {
    res.json({ memory: getMemory() });
  });

  // 7) Perfect Memory eintrag hinzufügen
  app.post('/api/memory', (req, res) => {
    const { type, content } = req.body;
    if (!type || !content) {
      return res.status(400).json({ error: 'type and content required' });
    }

    const memory = getMemory();
    memory.push({
      timestamp: new Date().toISOString(),
      type,
      content,
    });
    setMemory(memory);

    res.json({ success: true, entry: memory[memory.length - 1] });
  });

  // 8) Chat-History auslesen
  app.get('/api/chat', (req, res) => {
    res.json({ chatHistory: getChatHistory() });
  });

  // 9) Health Check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'AgenticFlow API' });
  });

  // ── Start Server (mit Port-Auto-Erkennung) ────────────
  const START_PORT = 3001;
  const MAX_TRIES   = 20;
  let activePort    = START_PORT;
  let server        = null;

  // Schreibt die tatsaechlich genutzte Adresse in eine Runtime-Datei,
  // damit MCP-Server / andere Agenten den richtigen Port finden.
  function writeRuntimeInfo(port) {
    try {
      const dir = path.join(__dirname, '..', 'MCP', '_runtime');
      fs.mkdirSync(dir, { recursive: true });
      const info = {
        service: 'AgenticFlow',
        port,
        baseUrl: `http://localhost:${port}`,
        pid: process.pid,
        startPort: START_PORT,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(dir, 'agentic-flow.json'), JSON.stringify(info, null, 2), 'utf8');
      console.log(`[API] Runtime-Info geschrieben: MCP/_runtime/agentic-flow.json (Port ${port})`);
    } catch (e) {
      console.warn('[API] Runtime-Info konnte nicht geschrieben werden:', e.message);
    }
  }

  // Versucht zu lauschen; bei belegtem Port automatisch den naechsten freien nehmen.
  function listenOn(port, attempt) {
    server = app.listen(port, 'localhost');
    server.once('listening', () => {
      activePort = port;
      console.log(`[API] AgenticFlow API Server läuft auf http://localhost:${port}`);
      console.log('[API] Endpoints: /api/connectors, /api/agents, /api/memory, /api/chat, /health');
      writeRuntimeInfo(port);
    });
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attempt < MAX_TRIES) {
        console.warn(`[API] Port ${port} belegt -> versuche ${port + 1}`);
        listenOn(port + 1, attempt + 1);
      } else {
        console.error('[API] Server-Start fehlgeschlagen:', err.message);
      }
    });
  }

  listenOn(START_PORT, 0);

  return {
    getPort: () => activePort,
    close: () => { if (server) server.close(); },
  };
};
