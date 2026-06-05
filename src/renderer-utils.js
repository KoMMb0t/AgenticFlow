// ── Helper Functions & Constants (Global) ─────────────────

window.$ = id => document.getElementById(id);

window.esc = s => (s || '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

window.relDate = d => {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
  return diff === 0 ? 'heute' : diff === 1 ? 'gestern' : `vor ${diff}d`;
};

window.genId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

window.APP_TEMPLATES = {
  // ☁ Clouds
  'google-drive': { cat: 'cloud',    name: 'Google Drive',  icon: '📁', color: '#0f9d58', url: 'https://drive.google.com' },
  'onedrive':     { cat: 'cloud',    name: 'OneDrive',      icon: '☁',  color: '#0078d4', url: 'https://onedrive.live.com' },
  'dropbox':      { cat: 'cloud',    name: 'Dropbox',       icon: '📦', color: '#0061ff', url: 'https://dropbox.com' },
  'terabox':      { cat: 'cloud',    name: 'TeraBox',       icon: '🗃',  color: '#ff6b35', url: 'https://www.terabox.com' },
  'mega':         { cat: 'cloud',    name: 'MEGA',          icon: '🔒', color: '#d9272e', url: 'https://mega.nz' },
  'nextcloud':    { cat: 'cloud',    name: 'Nextcloud',     icon: '🌩',  color: '#0082c9', url: '' },
  // 📱 Browser
  'chrome':       { cat: 'browser',  name: 'Chrome',        icon: '🌐', color: '#4285f4', url: 'https://google.com' },
  'firefox':      { cat: 'browser',  name: 'Firefox',       icon: '🦊', color: '#ff7139', url: 'https://start.mozilla.org' },
  'edge':         { cat: 'browser',  name: 'Edge',          icon: '🌀', color: '#0078d4', url: 'https://bing.com' },
  // 💬 Channels
  'slack':        { cat: 'channel',  name: 'Slack',         icon: 'S',  color: '#4a154b', url: 'https://app.slack.com' },
  'discord':      { cat: 'channel',  name: 'Discord',       icon: 'D',  color: '#5865f2', url: 'https://discord.com/app' },
  'telegram':     { cat: 'channel',  name: 'Telegram',      icon: 'T',  color: '#0088cc', url: 'https://web.telegram.org' },
  'whatsapp':     { cat: 'channel',  name: 'WhatsApp',      icon: 'W',  color: '#25d366', url: 'https://web.whatsapp.com' },
  'kchat':        { cat: 'channel',  name: 'kChat',         icon: '💬', color: '#1a73e8', url: 'https://kchat.infomaniak.com' },
  // 🔧 Services
  'github':       { cat: 'service',  name: 'GitHub',        icon: '⚡', color: '#58a6ff', url: 'https://github.com' },
  'gitlab':       { cat: 'service',  name: 'GitLab',        icon: '🦊', color: '#fc6d26', url: 'https://gitlab.com' },
  'gmail':        { cat: 'service',  name: 'Gmail',         icon: '✉',  color: '#ea4335', url: 'https://mail.google.com' },
  'outlook':      { cat: 'service',  name: 'Outlook',       icon: '📧', color: '#0078d4', url: 'https://outlook.live.com' },
  'notion':       { cat: 'service',  name: 'Notion',        icon: 'N',  color: '#eee',    url: 'https://notion.so' },
  'figma':        { cat: 'service',  name: 'Figma',         icon: '🎨', color: '#a259ff', url: 'https://figma.com' },
  'google-cloud': { cat: 'service',  name: 'Google Cloud',  icon: '☁',  color: '#4285f4', url: 'https://console.cloud.google.com' },
  'perplexity':   { cat: 'service',  name: 'Perplexity',    icon: '◎',  color: '#20808d', url: 'https://perplexity.ai' },
  // 🤖 KI (für AI Tabs)
  'chatgpt':      { cat: 'ai',       name: 'ChatGPT',       icon: '🤖', color: '#10a37f', url: 'https://chat.openai.com' },
  'claude-web':   { cat: 'ai',       name: 'Claude',        icon: '⚗',  color: '#cc785c', url: 'https://claude.ai' },
  'gemini':       { cat: 'ai',       name: 'Gemini',        icon: '✦',  color: '#4285f4', url: 'https://gemini.google.com' },
  'grok':         { cat: 'ai',       name: 'Grok',          icon: 'X',  color: '#aaa',    url: 'https://grok.com' },
  'manus':        { cat: 'ai',       name: 'Manus',         icon: 'M',  color: '#6c63ff', url: 'https://manus.im' },
};

window.AGENT_PROMPTS = {
  architect:  'Du bist der Architect-Agent. Analysiere Aufgaben, zerlege sie in Teilschritte und koordiniere andere Agenten. Wenn du delegierst: [DELEGATE:agentName:aufgabe]. Antworte auf Deutsch.',
  researcher: 'Du bist ein Researcher-Agent. Recherchiere gründlich und strukturiert. Antworte auf Deutsch.',
  coder:      'Du bist ein Coding-Agent. Schreibe, analysiere und verbessere Code. Erkläre Entscheidungen kurz.',
  writer:     'Du bist ein Writer-Agent. Formuliere Texte klar, präzise und ansprechend.',
  analyst:    'Du bist ein Analyst-Agent. Analysiere Daten und Muster strukturiert mit klaren Schlussfolgerungen.',
};
