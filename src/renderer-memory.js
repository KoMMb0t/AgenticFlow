// ── Right Panel: Perfect Memory Chat ─────────────────────

class MemoryManager {
  constructor() {
    this.voiceActive = false;
    this.entries = [];
  }

  init(state) {
    this.state = state;
    this.entries = state.perfectMemory || [];
    this.setupChat();
    this.setupRightToggle();
    this.renderWelcome();
  }

  setupChat() {
    const input  = $('memory-input');
    const sendBtn = $('btn-memory-send');
    const addBtn  = $('btn-memory-add');

    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.query(); }
    });
    sendBtn?.addEventListener('click', () => this.query());
    addBtn?.addEventListener('click', () => this.addEntry());

    // Voice listener
    window.addEventListener('voice-mode-changed', e => {
      this.voiceActive = e.detail?.active || false;
    });
  }

  async query() {
    const input = $('memory-input');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';

    this.addMsg('q', text);

    try {
      // Relevante Einträge finden
      const relevant = this.entries
        .filter(e => e.content?.toLowerCase().includes(text.toLowerCase().split(' ')[0]))
        .slice(0, 5);

      let system = 'Du bist ein persönlicher Assistent mit Zugriff auf das Perfect Memory des Nutzers. Antworte kurz und hilfreich auf Deutsch.';
      if (relevant.length) {
        system += '\n\nGespeicherte Infos:\n' + relevant.map(e => `• ${e.content}`).join('\n');
      }

      const resp = await window.api.claudeMessage({
        model:     'claude-haiku-4-5-20251001',
        system,
        messages:  [{ role: 'user', content: text }],
        apiKey:    this.state?.apiKeys?.claude,
        maxTokens: 400,
      });

      const answer = resp?.content || resp?.text || 'Keine Antwort.';
      this.addMsg('a', answer);
      if (this.voiceActive) this.speak(answer);

      // Auto-speichern bei Schlüsselwörtern
      const lower = text.toLowerCase();
      if (lower.startsWith('merke:') || lower.startsWith('speichere:') || lower.startsWith('notiz:')) {
        const content = text.replace(/^(merke|speichere|notiz):\s*/i, '');
        this.saveEntry(content);
      }
    } catch (e) {
      this.addMsg('a', `❌ Fehler: ${e.message}`);
    }
  }

  addEntry() {
    const text = prompt('Was soll gespeichert werden?');
    if (text?.trim()) {
      this.saveEntry(text.trim());
      this.addMsg('a', `✅ Gespeichert: "${text.trim()}"`);
    }
  }

  saveEntry(content) {
    const entry = { id: genId(), content, createdAt: new Date().toISOString() };
    this.entries.push(entry);
    if (this.state) this.state.perfectMemory = this.entries;
    window.api.memorySave?.(entry);
  }

  addMsg(type, text) {
    const container = $('memory-messages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `memory-msg ${type}`;
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  renderWelcome() {
    if (!this.entries.length) {
      this.addMsg('a', '🧠 Hallo! Ich bin dein Perfect Memory.\n\nFrage mich etwas oder sag "Merke: [info]" zum Speichern.');
    }
  }

  speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'de-DE';
    utt.rate = 1.0;
    window.speechSynthesis.speak(utt);
  }

  setupRightToggle() {
    const btn   = $('right-toggle');
    const panel = $('right-panel');
    const collapsed = localStorage.getItem('af_right_collapsed') === 'true';

    if (panel && collapsed) panel.classList.add('collapsed');
    if (btn) {
      btn.classList.toggle('active', !collapsed);
      btn.addEventListener('click', () => {
        const isNowCollapsed = panel?.classList.toggle('collapsed');
        btn.classList.toggle('active', !isNowCollapsed);
        localStorage.setItem('af_right_collapsed', isNowCollapsed ? 'true' : 'false');
      });
    }
  }
}

window.memoryMgr = new MemoryManager();
