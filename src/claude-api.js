/**
 * AgenticFlow — Claude API Bridge (Main Process)
 * Handles all Anthropic API calls with streaming support
 */

const { ipcMain } = require('electron');

let Anthropic = null;
let client     = null;

function getClient(apiKey) {
  if (!apiKey) throw new Error('Kein API-Key gesetzt');
  if (!client || client._apiKey !== apiKey) {
    if (!Anthropic) Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey });
    client._apiKey = apiKey;
  }
  return client;
}

// Models available
const MODELS = [
  { id: 'claude-opus-4-8',    name: 'Claude Opus 4.8',    tier: 'architect' },
  { id: 'claude-sonnet-4-6',  name: 'Claude Sonnet 4.6',  tier: 'worker'    },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tier: 'fast' },
];

// Agent roles / system prompts
const AGENT_PROMPTS = {
  architect: `Du bist der Architect-Agent in AgenticFlow. Du bist der leitende KI-Agent, der:
- Aufgaben analysiert und in Teilaufgaben zerlegt
- Arbeit an spezialisierte Worker-Agenten delegiert
- Ergebnisse zusammenführt und dem Nutzer präsentiert
- Den Überblick über alle laufenden Aufgaben behält
Antworte immer auf Deutsch (oder in der Sprache des Nutzers).
Wenn du Arbeit delegierst, nutze das Format: [DELEGATE:agentName:task]`,

  researcher: `Du bist ein Researcher-Agent. Du recherchierst Informationen gründlich und strukturiert.
Fasse Ergebnisse klar zusammen. Verweise auf Quellen wenn möglich.`,

  coder: `Du bist ein Coding-Agent. Du schreibst, analysierst und verbesserst Code.
Erkläre deine Entscheidungen kurz. Nutze Best Practices.`,

  writer: `Du bist ein Writer-Agent. Du formulierst Texte klar, präzise und ansprechend.`,

  analyst: `Du bist ein Analyst-Agent. Du analysierst Daten, Trends und Muster.`,

  memory: `Du bist der Perfect Memory Agent. Du hilfst dabei:
- Wichtige Informationen zu speichern und abzurufen
- Kontext zwischen Gesprächen herzustellen
- Das Wissen des Nutzers zu organisieren
Du hast Zugriff auf alle gespeicherten Notizen und Erinnerungen des Nutzers.`,
};

// ── Alternative API-Provider (OpenAI, Gemini) ────────────────
// Nicht-streamend — Antwort wird als ein Chunk geliefert.

async function openaiChat({ messages, model, apiKey, system }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model:    model || 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
  return { text: data.choices?.[0]?.message?.content || '', usage: data.usage };
}

async function geminiChat({ messages, model, apiKey, system }) {
  const m = model || 'gemini-1.5-flash';
  const contents = messages.map(x => ({
    role:  x.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: x.content }],
  }));
  // Key im Header (nicht in der URL!)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  return { text, usage: data.usageMetadata };
}

// ── IPC Handlers ─────────────────────────────────────────────

function registerHandlers(store) {

  // Single message (non-streaming) — for agent delegation etc.
  ipcMain.handle('claude-message', async (event, { agentRole, messages, model, apiKey, provider }) => {
    try {
      const systemPrompt = AGENT_PROMPTS[agentRole] || AGENT_PROMPTS.architect;

      if (provider === 'openai') {
        const r = await openaiChat({ messages, model, apiKey, system: systemPrompt });
        return { ok: true, content: r.text, usage: r.usage };
      }
      if (provider === 'gemini') {
        const r = await geminiChat({ messages, model, apiKey, system: systemPrompt });
        return { ok: true, content: r.text, usage: r.usage };
      }

      const c = getClient(apiKey || store.get('claudeApiKey'));
      const response = await c.messages.create({
        model:      model || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system:     systemPrompt,
        messages,
      });

      return { ok: true, content: response.content[0]?.text || '', usage: response.usage };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Streaming message — sends chunks back to renderer
  ipcMain.on('claude-stream', async (event, { agentRole, messages, model, apiKey, streamId, provider }) => {
    try {
      const systemPromptAlt = AGENT_PROMPTS[agentRole] || AGENT_PROMPTS.architect;

      // OpenAI / Gemini: nicht-streamend, Antwort als ein Chunk
      if (provider === 'openai' || provider === 'gemini') {
        const fn = provider === 'openai' ? openaiChat : geminiChat;
        const r  = await fn({ messages, model, apiKey, system: systemPromptAlt });
        event.sender.send(`claude-stream-chunk:${streamId}`, { text: r.text });
        event.sender.send(`claude-stream-done:${streamId}`,  { usage: r.usage, stopReason: 'end' });
        return;
      }

      const c = getClient(apiKey || store.get('claudeApiKey'));
      const systemPrompt = AGENT_PROMPTS[agentRole] || AGENT_PROMPTS.architect;

      const stream = await c.messages.create({
        model:      model || 'claude-sonnet-4-6',
        max_tokens: 8192,
        system:     systemPrompt,
        messages,
        stream:     true,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          event.sender.send(`claude-stream-chunk:${streamId}`, { text: chunk.delta.text });
        }
        if (chunk.type === 'message_stop') {
          const finalMsg = await stream.finalMessage();
          event.sender.send(`claude-stream-done:${streamId}`, {
            usage: finalMsg.usage,
            stopReason: finalMsg.stop_reason,
          });
        }
      }
    } catch (err) {
      event.sender.send(`claude-stream-error:${streamId}`, { error: err.message });
    }
  });

  // Get available models
  ipcMain.handle('claude-models', () => MODELS);

  // Save API key
  ipcMain.on('save-api-key', (event, { service, key }) => {
    store.set(`apiKeys.${service}`, key);
  });

  ipcMain.handle('get-api-keys', () => store.get('apiKeys', {}));

  // Perfect Memory operations
  ipcMain.handle('memory-get-all', () => store.get('perfectMemory', []));

  ipcMain.on('memory-save', (event, entry) => {
    const mem = store.get('perfectMemory', []);
    const existing = mem.findIndex(m => m.id === entry.id);
    if (existing >= 0) mem[existing] = entry;
    else mem.push({ ...entry, id: entry.id || `mem_${Date.now()}`, ts: Date.now() });
    store.set('perfectMemory', mem);
  });

  ipcMain.on('memory-delete', (event, id) => {
    const mem = store.get('perfectMemory', []).filter(m => m.id !== id);
    store.set('perfectMemory', mem);
  });

  // Project management
  ipcMain.handle('projects-get', () => store.get('projects', []));

  ipcMain.handle('project-create', (event, project) => {
    const projects = store.get('projects', []);
    const newProject = {
      ...project,
      id:        `proj_${Date.now()}`,
      createdAt: Date.now(),
      agents:    project.agents || [],
      tasks:     [],
      chatHistory: [],
    };
    projects.push(newProject);
    store.set('projects', projects);
    return newProject;
  });

  ipcMain.handle('project-update', (event, { id, updates }) => {
    const projects = store.get('projects', []);
    const idx = projects.findIndex(p => p.id === id);
    if (idx >= 0) { projects[idx] = { ...projects[idx], ...updates }; store.set('projects', projects); }
    return projects[idx] || null;
  });

  ipcMain.on('project-add-message', (event, { projectId, message }) => {
    const projects = store.get('projects', []);
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx >= 0) {
      projects[idx].chatHistory = projects[idx].chatHistory || [];
      projects[idx].chatHistory.push(message);
      if (projects[idx].chatHistory.length > 1000)
        projects[idx].chatHistory.splice(0, projects[idx].chatHistory.length - 1000);
      store.set('projects', projects);
    }
  });
}

module.exports = { registerHandlers, MODELS, AGENT_PROMPTS };
