// AgenticFlow — Renderer

// ── State ────────────────────────────────────────────────────
const S = {
  leftCollapsed:   false,
  rightCollapsed:  false,
  connectors:      [],
  rightApps:       [],
  activeCenterId:  null,
  activeRightId:   null,
  connTemplates:   [],
  rightTemplates:  [],
  projects:        [],
  activeProjectId: null,
  apiKeys:         {},
  chatMessages:    [],
  perfectMemory:   [],
  activeAgent:     'architect',
  rightTab:        'agents',
  currentView:     'home',   // 'home' | 'project' | 'chat'
  modalMode:       null,
  modalTpl:        null,
  filterCat:       'all',
  ctxTarget:       null,
  ctxPanel:        null,
};

const $ = id => document.getElementById(id);

// ── Init ─────────────────────────────────────────────────────
window.api.onAppReady(data => {
  Object.assign(S, {
    leftCollapsed:   data.leftCollapsed,
    rightCollapsed:  data.rightCollapsed,
    connectors:      data.connectors      || [],
    rightApps:       data.rightApps       || [],
    activeCenterId:  data.activeCenterId,
    activeRightId:   data.activeRightId,
    connTemplates:   data.connTemplates   || [],
    rightTemplates:  data.rightTemplates  || [],
    projects:        data.projects        || [],
    activeProjectId: data.activeProjectId,
    apiKeys:         data.apiKeys         || {},
    chatMessages:    data.chatHistory     || [],
    perfectMemory:   data.perfectMemory   || [],
  });

  applyPanels();
  renderLeft();
  renderRightApps();
  renderTabs();
  renderMemoryEntries();

  // Restore API key UI
  if (S.apiKeys.claude) $('inp-claude-key').value = '••••••••••••' + S.apiKeys.claude.slice(-4);

  // Restore view
  if (S.activeProjectId) openProject(S.projects.find(p => p.id === S.activeProjectId));
  else showView('home');

  if (S.activeCenterId) showConnectorBar(S.activeCenterId);
  sendLayout();
});

window.api.onWindowResized(sendLayout);

// ── Layout ───────────────────────────────────────────────────
function sendLayout() {
  requestAnimationFrame(() => {
    const cp  = $('center-panel').getBoundingClientRect();
    const rp  = $('right-panel').getBoundingClientRect();
    const svcH = S.activeCenterId ? 38 : 0;

    window.api.updateLayout({
      center: S.activeCenterId ? {
        x: Math.round(cp.left), y: Math.round(cp.top + svcH),
        width: Math.round(cp.width), height: Math.round(cp.height - svcH),
      } : null,
      right: (S.activeRightId && !S.rightCollapsed && rp.width > 10) ? {
        x: Math.round(rp.left), y: Math.round(rp.top + 60 + 40), // tabs + strip
        width: Math.round(rp.width), height: Math.round(rp.height - 100),
      } : null,
    });
  });
}

// ── Panel collapse ────────────────────────────────────────────
function applyPanels() {
  $('left-panel').classList.toggle('collapsed', S.leftCollapsed);
  $('right-panel').classList.toggle('collapsed', S.rightCollapsed);
  $('left-toggle').classList.toggle('active', !S.leftCollapsed);
  $('right-toggle').classList.toggle('active', !S.rightCollapsed);
}

$('left-toggle').addEventListener('click', () => {
  S.leftCollapsed = !S.leftCollapsed; applyPanels();
  window.api.setLeftCollapsed(S.leftCollapsed); setTimeout(sendLayout, 220);
});
$('right-toggle').addEventListener('click', () => {
  S.rightCollapsed = !S.rightCollapsed; applyPanels();
  window.api.setRightCollapsed(S.rightCollapsed);
  S.rightCollapsed ? sendLayout() : setTimeout(sendLayout, 220);
});

// ── Views ─────────────────────────────────────────────────────
function showView(name) {
  S.currentView = name;
  $('view-home').style.display    = name === 'home'    ? 'flex'  : 'none';
  $('view-project').style.display = name === 'project' ? 'flex'  : 'none';
  $('view-chat').style.display    = name === 'chat'    ? 'flex'  : 'none';

  if (name === 'home') {
    renderProjects();
    // Remove service-tabs from header
    document.querySelectorAll('.tab[data-type="conn"]').forEach(t => t.remove());
    $('tab-home').classList.add('tab--active');
  }
  if (name === 'chat' && S.chatMessages.length === 0) renderChatWelcome();
}

// ── Left panel ────────────────────────────────────────────────
function renderLeft() {
  const clouds   = S.connectors.filter(c => c.cat === 'cloud');
  const services = S.connectors.filter(c => c.cat !== 'cloud');
  renderConnList($('cloud-list'),   clouds);
  renderConnList($('service-list'), services);
}

function renderConnList(container, list) {
  if (!list.length) { container.innerHTML = `<div class="empty-hint">Konnektoren per + hinzufügen</div>`; return; }
  container.innerHTML = '';
  list.forEach(c => container.appendChild(makeConnItem(c)));
}

function makeConnItem(c) {
  const el = document.createElement('div');
  el.className = 'conn-item' + (S.activeCenterId === c.instanceId ? ' active' : '');
  el.dataset.id = c.instanceId;
  el.innerHTML = `
    <div class="conn-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</div>
    <div class="conn-info">
      <div class="conn-name">${esc(c.name)}</div>
      <div class="conn-label">${esc(c.label)}</div>
    </div>
    <div class="conn-acts">
      <button class="conn-act" data-a="reload">↺</button>
      <button class="conn-act danger" data-a="remove">✕</button>
    </div>`;
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'reload') { window.api.reloadView('center', c.instanceId); return; }
    if (a === 'remove') { removeConnector(c.instanceId); return; }
    switchCenter(c.instanceId);
  });
  el.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e.clientX, e.clientY, c.instanceId, 'center'); });
  return el;
}

// ── Right panel ───────────────────────────────────────────────
function renderRightApps() {
  const list = $('right-app-list');
  list.innerHTML = '';
  $('right-placeholder').style.display = S.rightApps.length ? 'none' : 'flex';

  S.rightApps.forEach(app => {
    const chip = document.createElement('div');
    chip.className = 'app-chip' + (S.activeRightId === app.instanceId ? ' active' : '');
    chip.dataset.id = app.instanceId;
    chip.style.background = app.color + '22';
    chip.style.color = app.color;
    chip.title = `${app.name} — ${app.label}`;
    chip.innerHTML = `<span class="chip-ico">${app.icon}</span><span class="chip-lbl">${esc(app.label)}</span>`;
    chip.addEventListener('click', () => switchRight(app.instanceId));
    chip.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e.clientX, e.clientY, app.instanceId, 'right'); });
    list.appendChild(chip);
  });
}

// Right tabs
$('rtab-agents').addEventListener('click', () => switchRightTab('agents'));
$('rtab-memory').addEventListener('click', () => switchRightTab('memory'));

function switchRightTab(tab) {
  S.rightTab = tab;
  $('rtab-agents').classList.toggle('rtab--active', tab === 'agents');
  $('rtab-memory').classList.toggle('rtab--active', tab === 'memory');
  $('right-agents-view').style.display = tab === 'agents' ? 'flex' : 'none';
  $('right-memory-view').style.display = tab === 'memory' ? 'flex' : 'none';
  if (tab === 'memory') sendLayout(); // hide right BrowserView
  else sendLayout();
}

// ── Center tabs ───────────────────────────────────────────────
function renderTabs() {
  document.querySelectorAll('.tab[data-type="conn"]').forEach(t => t.remove());
  $('tab-home').classList.toggle('tab--active', S.currentView === 'home' && !S.activeCenterId);

  S.connectors.forEach(c => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (S.activeCenterId === c.instanceId ? ' tab--active' : '');
    tab.dataset.type = 'conn';
    tab.dataset.id   = c.instanceId;
    tab.innerHTML = `<span>${c.icon}</span><span class="tl">${esc(c.name)}</span><button class="tab-x" data-close="${c.instanceId}">✕</button>`;
    tab.addEventListener('click', e => {
      if (e.target.dataset.close) { switchCenter(null); return; }
      switchCenter(c.instanceId);
    });
    $('center-tabs').appendChild(tab);
  });
}

// ── Projects ──────────────────────────────────────────────────
function renderProjects() {
  const grid = $('project-grid');
  grid.innerHTML = '';
  const hw = $('home-welcome');

  if (!S.projects.length) {
    hw.style.display = 'flex';
    return;
  }
  hw.style.display = 'none';

  S.projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'proj-card';
    card.innerHTML = `
      <div class="proj-card-icon">🏗</div>
      <div class="proj-card-name">${esc(p.name)}</div>
      <div class="proj-card-desc">${esc(p.description || 'Kein Beschreibung')}</div>
      <div class="proj-card-meta">
        <span class="proj-card-model">${modelShort(p.model)}</span>
        <span class="proj-card-date">${relDate(p.createdAt)}</span>
      </div>`;
    card.addEventListener('click', () => openProject(p));
    grid.appendChild(card);
  });
}

function openProject(p) {
  if (!p) return;
  S.activeProjectId = p.id;
  window.api.setActiveProject(p.id);
  showView('project');

  $('proj-title').textContent = p.name;
  $('architect-model').value  = p.model || 'claude-sonnet-4-6';

  // Load project chat history
  const msgs = $('proj-messages');
  msgs.innerHTML = '';
  (p.chatHistory || []).forEach(m => appendProjMsg(m, false));
  msgs.scrollTop = msgs.scrollHeight;

  // Add project tab to header
  document.querySelectorAll('.tab[data-type="project"]').forEach(t => t.remove());
  $('tab-home').classList.remove('tab--active');

  const tab = document.createElement('button');
  tab.className = 'tab tab--active';
  tab.dataset.type = 'project';
  tab.dataset.id   = p.id;
  tab.innerHTML = `<span>🏗</span><span class="tl">${esc(p.name)}</span><button class="tab-x">✕</button>`;
  tab.querySelector('.tab-x').addEventListener('click', () => {
    tab.remove(); S.activeProjectId = null; window.api.setActiveProject(null); showView('home');
  });
  tab.addEventListener('click', e => { if (!e.target.classList.contains('tab-x')) openProject(p); });
  $('center-tabs').insertBefore(tab, $('center-tabs').firstChild.nextSibling);
}

$('btn-back-home').addEventListener('click', () => { S.activeProjectId = null; window.api.setActiveProject(null); showView('home'); });
$('tab-home').addEventListener('click', () => { if (S.currentView !== 'home') { S.activeProjectId = null; showView('home'); } });

// New project modal
function openProjModal() {
  $('proj-name-inp').value = '';
  $('proj-desc-inp').value = '';
  $('proj-modal-overlay').style.display = 'flex';
  setTimeout(() => $('proj-name-inp').focus(), 50);
}
$('btn-new-project').addEventListener('click', openProjModal);
$('btn-new-project-2').addEventListener('click', openProjModal);
$('proj-modal-close').addEventListener('click', () => { $('proj-modal-overlay').style.display = 'none'; });
$('proj-modal-cancel').addEventListener('click', () => { $('proj-modal-overlay').style.display = 'none'; });

$('proj-modal-create').addEventListener('click', async () => {
  const name  = $('proj-name-inp').value.trim();
  if (!name) { $('proj-name-inp').focus(); return; }
  const p = await window.api.projectCreate({
    name,
    description: $('proj-desc-inp').value.trim(),
    model:       $('proj-model-inp').value,
  });
  S.projects.push(p);
  $('proj-modal-overlay').style.display = 'none';
  openProject(p);
});

// ── Agent tabs (in project view) ─────────────────────────────
document.querySelectorAll('.agent-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.agent-tab').forEach(b => b.classList.remove('agent-tab--active'));
    btn.classList.add('agent-tab--active');
    S.activeAgent = btn.dataset.agent;
  });
});

// ── Project chat (Architect) ──────────────────────────────────
$('proj-send-btn').addEventListener('click', sendProjMessage);
$('proj-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendProjMessage(); }
});
$('proj-input').addEventListener('input', autoResize);

async function sendProjMessage() {
  const text = $('proj-input').value.trim();
  if (!text) return;

  const apiKey = S.apiKeys.claude;
  if (!apiKey) {
    alert('Bitte zuerst einen Anthropic API-Key in den Einstellungen hinterlegen.');
    $('settings-overlay').style.display = 'flex';
    return;
  }

  const userMsg = { role: 'user', content: text, agent: S.activeAgent, ts: Date.now() };
  appendProjMsg(userMsg);
  window.api.projectAddMessage(S.activeProjectId, userMsg);
  $('proj-input').value = '';
  $('proj-input').style.height = 'auto';

  // Build context from project history
  const proj    = S.projects.find(p => p.id === S.activeProjectId);
  const history = (proj?.chatHistory || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-20)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

  // Set agent status
  setAgentStatus(S.activeAgent, 'working');
  $('proj-status').textContent = `${agentLabel(S.activeAgent)} arbeitet…`;
  $('proj-status').className   = 'status-badge status-working';

  // Placeholder streaming message
  const aMsg = { role: 'assistant', content: '', agent: S.activeAgent, ts: Date.now() };
  const msgEl = appendProjMsg(aMsg, true, true);
  let fullText = '';

  window.api.claudeStream(
    {
      agentRole: S.activeAgent,
      messages:  [...history, { role: 'user', content: text }],
      model:     $('architect-model').value,
      apiKey,
    },
    chunk => {
      fullText += chunk;
      const bubble = msgEl.querySelector('.msg-bubble');
      if (bubble) { bubble.textContent = fullText; bubble.classList.add('streaming-cursor'); }
      $('proj-messages').scrollTop = $('proj-messages').scrollHeight;
    },
    done => {
      const bubble = msgEl.querySelector('.msg-bubble');
      if (bubble) bubble.classList.remove('streaming-cursor');
      aMsg.content = fullText;
      window.api.projectAddMessage(S.activeProjectId, { ...aMsg, content: fullText });
      setAgentStatus(S.activeAgent, 'done');
      $('proj-status').textContent = 'bereit';
      $('proj-status').className   = 'status-badge status-idle';
      // Check for delegation instructions
      handleDelegation(fullText);
    },
    err => {
      const bubble = msgEl.querySelector('.msg-bubble');
      if (bubble) { bubble.textContent = `Fehler: ${err}`; bubble.classList.remove('streaming-cursor'); }
      setAgentStatus(S.activeAgent, 'error');
      $('proj-status').textContent = 'Fehler';
      $('proj-status').className   = 'status-badge status-error';
    }
  );
}

function handleDelegation(text) {
  const regex = /\[DELEGATE:(\w+):([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, agentName, task] = match;
    const sysMsg = { role: 'system', content: `🏗 Architect delegiert an ${agentLabel(agentName)}: "${task}"`, ts: Date.now() };
    appendProjMsg(sysMsg);
  }
}

function appendProjMsg(msg, scroll = true, returnEl = false) {
  const msgs = $('proj-messages');
  const el   = document.createElement('div');

  if (msg.role === 'system') {
    el.className = 'msg msg--system';
    el.innerHTML = `<div class="msg-bubble">${esc(msg.content)}</div>`;
  } else {
    el.className = `msg msg--${msg.role === 'user' ? 'user' : 'assistant'}`;
    const avatar  = msg.role === 'user' ? 'Du' : agentEmoji(msg.agent);
    const agLabel = msg.role !== 'user' ? `<div class="msg-agent">${agentLabel(msg.agent || 'architect')}</div>` : '';
    const time    = new Date(msg.ts).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML  = `
      <div class="msg-avatar">${avatar}</div>
      <div class="msg-inner">
        ${agLabel}
        <div class="msg-bubble">${esc(msg.content)}</div>
        <div class="msg-time">${time}</div>
      </div>`;
  }

  msgs.appendChild(el);
  if (scroll) msgs.scrollTop = msgs.scrollHeight;
  return returnEl ? el : undefined;
}

function setAgentStatus(agent, status) {
  const dot = document.querySelector(`.agent-tab[data-agent="${agent}"] .at-status`);
  if (dot) { dot.className = `at-status status-${status}`; }
}

// ── Chat (standalone) ─────────────────────────────────────────
function renderChatWelcome() {
  $('chat-messages').innerHTML = `
    <div class="chat-welcome">
      <div class="hw-glow"></div>
      <div class="hw-icon">⚡</div>
      <h2>AgenticFlow Chat</h2>
      <p>Direkt mit einem KI-Modell chatten oder ein Projekt öffnen.</p>
    </div>`;
}

$('send-btn').addEventListener('click', sendChatMessage);
$('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
});
$('chat-input').addEventListener('input', autoResize);

async function sendChatMessage() {
  const text = $('chat-input').value.trim();
  if (!text) return;

  const apiKey = S.apiKeys.claude;
  if (!apiKey) { alert('Bitte API-Key in den Einstellungen hinterlegen.'); return; }

  const msgs = $('chat-messages');
  msgs.querySelector('.chat-welcome')?.remove();

  const userMsg = { role: 'user', content: text, ts: Date.now() };
  S.chatMessages.push(userMsg);
  window.api.saveChatMessage(userMsg);
  appendChatMsg(userMsg);
  $('chat-input').value = ''; $('chat-input').style.height = 'auto';

  const aEl = appendChatMsg({ role: 'assistant', content: '', ts: Date.now() }, true, true);
  let full  = '';

  window.api.claudeStream(
    {
      agentRole: 'architect',
      messages:  S.chatMessages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-20).map(m => ({ role: m.role, content: m.content })),
      model:     $('model-select').value,
      apiKey,
    },
    chunk => {
      full += chunk;
      const b = aEl.querySelector('.msg-bubble');
      if (b) { b.textContent = full; b.classList.add('streaming-cursor'); }
      msgs.scrollTop = msgs.scrollHeight;
    },
    () => {
      aEl.querySelector('.msg-bubble')?.classList.remove('streaming-cursor');
      const m = { role: 'assistant', content: full, ts: Date.now() };
      S.chatMessages.push(m); window.api.saveChatMessage(m);
    },
    err => {
      const b = aEl.querySelector('.msg-bubble');
      if (b) { b.textContent = `Fehler: ${err}`; b.classList.remove('streaming-cursor'); }
    }
  );
}

function appendChatMsg(msg, scroll = true, ret = false) {
  const msgs = $('chat-messages');
  const el   = document.createElement('div');
  el.className = `msg msg--${msg.role}`;
  const av   = msg.role === 'user' ? 'Du' : '⚡';
  const time = new Date(msg.ts).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `
    <div class="msg-avatar">${av}</div>
    <div class="msg-inner">
      <div class="msg-bubble">${esc(msg.content)}</div>
      <div class="msg-time">${time}</div>
    </div>`;
  msgs.appendChild(el);
  if (scroll) msgs.scrollTop = msgs.scrollHeight;
  return ret ? el : undefined;
}

$('btn-clear-chat')?.addEventListener('click', () => {
  if (!confirm('Chat leeren?')) return;
  S.chatMessages = []; window.api.clearChatHistory(); renderChatWelcome();
});

// ── Connector switching ───────────────────────────────────────
function switchCenter(id) {
  S.activeCenterId = id;
  window.api.switchCenter(id);
  document.querySelectorAll('.conn-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('tab--active', t.dataset.id === id));
  if (id) showConnectorBar(id);
  else hideConnectorBars();
  sendLayout();
}

function showConnectorBar(id) {
  const c = S.connectors.find(x => x.instanceId === id);
  if (!c) return;
  // Show appropriate bar based on current view
  if (S.currentView === 'project') {
    $('connector-bar').style.display = 'flex';
    $('connector-bar').querySelector('#cb-icon').textContent  = c.icon;
    $('connector-bar').querySelector('#cb-name').textContent  = c.name;
    $('connector-bar').querySelector('#cb-label').textContent = c.label;
  }
  if (S.currentView === 'chat') {
    $('svc-bar-simple').style.display = 'flex';
    $('svc-icon-s').textContent  = c.icon;
    $('svc-name-s').textContent  = c.name;
    $('svc-label-s').textContent = c.label;
  }
}

function hideConnectorBars() {
  $('connector-bar').style.display  = 'none';
  $('svc-bar-simple').style.display = 'none';
}

$('cb-close').addEventListener('click',    () => switchCenter(null));
$('cb-reload').addEventListener('click',   () => S.activeCenterId && window.api.reloadView('center', S.activeCenterId));
$('cb-logout').addEventListener('click',   () => S.activeCenterId && window.api.logoutAccount('center', S.activeCenterId));
$('svc-close-s').addEventListener('click', () => switchCenter(null));
$('svc-reload-s').addEventListener('click',() => S.activeCenterId && window.api.reloadView('center', S.activeCenterId));
$('svc-logout-s').addEventListener('click',() => S.activeCenterId && window.api.logoutAccount('center', S.activeCenterId));

function switchRight(id) {
  S.activeRightId = id;
  window.api.switchRight(id);
  document.querySelectorAll('.app-chip').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  $('right-placeholder').style.display = 'none';
  sendLayout();
}

// ── Remove helpers ────────────────────────────────────────────
function removeConnector(id) {
  window.api.removeConnector(id);
  S.connectors = S.connectors.filter(c => c.instanceId !== id);
  if (S.activeCenterId === id) switchCenter(null);
  renderLeft(); renderTabs();
}
function removeRightApp(id) {
  window.api.removeRightApp(id);
  S.rightApps = S.rightApps.filter(a => a.instanceId !== id);
  if (S.activeRightId === id) { S.activeRightId = null; sendLayout(); }
  renderRightApps();
}

window.api.onConnectorRemoved(id => { S.connectors = S.connectors.filter(c => c.instanceId !== id); if (S.activeCenterId === id) switchCenter(null); renderLeft(); renderTabs(); });
window.api.onRightAppRemoved(id => { S.rightApps = S.rightApps.filter(a => a.instanceId !== id); if (S.activeRightId === id) { S.activeRightId = null; sendLayout(); } renderRightApps(); });

// ── Modal (Connector / App) ───────────────────────────────────
function openModal(mode) {
  S.modalMode = mode; S.modalTpl = null; S.filterCat = 'all';
  $('tpl-step').style.display  = 'block';
  $('form-step').style.display = 'none';
  $('inp-label').value = ''; $('inp-url').value = '';

  const templates = mode === 'right' ? S.rightTemplates : S.connTemplates;
  $('modal-title').textContent = mode === 'right' ? 'Agent / App verbinden' :
                                  mode === 'left-cloud' ? 'Cloud-Speicher hinzufügen' : 'Dienst hinzufügen';

  // Filter chips
  const allCats = [...new Set(templates.map(t => t.cat))];
  $('tpl-filter').innerHTML = `<button class="filter-chip active" data-cat="all">Alle</button>` +
    allCats.map(c => `<button class="filter-chip" data-cat="${c}">${catLabel(c)}</button>`).join('');

  $('tpl-filter').querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $('tpl-filter').querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.filterCat = btn.dataset.cat;
      renderTplGrid(templates);
    });
  });

  renderTplGrid(templates);
  $('modal-overlay').style.display = 'flex';
}

function renderTplGrid(templates) {
  const filtered = S.filterCat === 'all' ? templates : templates.filter(t => t.cat === S.filterCat);
  $('tpl-grid').innerHTML = '';
  filtered.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tpl-card';
    card.innerHTML = `<div class="tpl-ico" style="background:${t.color}22;color:${t.color}">${t.icon}</div><div class="tpl-name">${esc(t.name)}</div>`;
    card.addEventListener('click', () => selectTpl(t));
    $('tpl-grid').appendChild(card);
  });
}

function selectTpl(t) {
  S.modalTpl = t;
  $('tpl-step').style.display  = 'none';
  $('form-step').style.display = 'flex';
  $('form-preview').innerHTML  = `<div class="fp-ico" style="background:${t.color}22;color:${t.color}">${t.icon}</div><div class="fp-name">${esc(t.name)}</div>`;
  $('inp-url-group').style.display = (!t.url || t.id === 'custom') ? 'block' : 'none';
  $('inp-label').focus();
}

$('add-cloud-btn').addEventListener('click',   () => openModal('left-cloud'));
$('add-service-btn').addEventListener('click', () => openModal('left-service'));
$('add-app-btn').addEventListener('click',     () => openModal('right'));
$('add-app-ph-btn').addEventListener('click',  () => openModal('right'));
$('modal-close').addEventListener('click',  closeModal);
$('modal-back').addEventListener('click',   () => { $('tpl-step').style.display = 'block'; $('form-step').style.display = 'none'; S.modalTpl = null; });
$('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });

$('modal-create').addEventListener('click', async () => {
  if (!S.modalTpl) return;
  const label = $('inp-label').value.trim() || 'Account';
  const url   = $('inp-url').value.trim();

  // Count existing same-type accounts for numbering
  const existing = (S.modalMode === 'right' ? S.rightApps : S.connectors).filter(x => x.templateId === S.modalTpl.id).length;

  if (S.modalMode === 'right') {
    const app = await window.api.addRightApp({ templateId: S.modalTpl.id, label, customUrl: url, accountIndex: existing + 1 });
    if (app) { S.rightApps.push(app); renderRightApps(); switchRight(app.instanceId); }
  } else {
    const conn = await window.api.addConnector({ templateId: S.modalTpl.id, label, customUrl: url, accountIndex: existing + 1 });
    if (conn) { S.connectors.push(conn); renderLeft(); renderTabs(); switchCenter(conn.instanceId); }
  }
  closeModal();
});

function closeModal() { $('modal-overlay').style.display = 'none'; S.modalTpl = null; S.modalMode = null; }

// ── Settings ──────────────────────────────────────────────────
$('btn-settings').addEventListener('click',   () => { $('settings-overlay').style.display = 'flex'; });
$('btn-proj-settings').addEventListener('click', () => { $('settings-overlay').style.display = 'flex'; });
$('settings-close').addEventListener('click', () => { $('settings-overlay').style.display = 'none'; });
$('settings-overlay').addEventListener('click', e => { if (e.target === $('settings-overlay')) $('settings-overlay').style.display = 'none'; });

$('save-claude-key').addEventListener('click', () => {
  const key = $('inp-claude-key').value.trim();
  if (!key || key.startsWith('••')) return;
  S.apiKeys.claude = key;
  window.api.saveApiKey('claude', key);
  $('inp-claude-key').value = '••••••••••••' + key.slice(-4);
  $('settings-overlay').style.display = 'none';
});

// ── Perfect Memory ────────────────────────────────────────────
function renderMemoryEntries() {
  const container = $('memory-entries');
  container.innerHTML = '';
  $('mem-count').textContent = S.perfectMemory.length;

  if (!S.perfectMemory.length) {
    container.innerHTML = `<div class="empty-hint">Noch keine Einträge gespeichert.</div>`;
    return;
  }

  [...S.perfectMemory].reverse().forEach(m => {
    const el = document.createElement('div');
    el.className = 'mem-entry';
    el.innerHTML = `
      <div class="mem-entry-text">${esc(m.text || m.content || '')}</div>
      <div class="mem-entry-time">${new Date(m.ts).toLocaleString('de')}</div>
      <button class="mem-del" data-id="${m.id}">✕</button>`;
    el.querySelector('.mem-del').addEventListener('click', () => {
      window.api.memoryDelete(m.id);
      S.perfectMemory = S.perfectMemory.filter(x => x.id !== m.id);
      renderMemoryEntries();
    });
    container.appendChild(el);
  });
}

$('memory-send-btn').addEventListener('click', sendMemoryMessage);
$('memory-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMemoryMessage(); }
});
$('memory-input').addEventListener('input', autoResize);

async function sendMemoryMessage() {
  const text = $('memory-input').value.trim();
  if (!text) return;
  const apiKey = S.apiKeys.claude;

  // Decide: save or query?
  const isSave = /^(speicher|merke|notier|save|remember)/i.test(text);

  const msgs = $('memory-messages');
  msgs.querySelector('.memory-welcome')?.remove();

  // User msg
  const uEl = document.createElement('div');
  uEl.className = 'msg msg--user';
  uEl.innerHTML = `<div class="msg-avatar">Du</div><div class="msg-inner"><div class="msg-bubble">${esc(text)}</div></div>`;
  msgs.appendChild(uEl);
  msgs.scrollTop = msgs.scrollHeight;
  $('memory-input').value = ''; $('memory-input').style.height = 'auto';

  if (isSave) {
    const entry = { id: `mem_${Date.now()}`, text, ts: Date.now() };
    window.api.memorySave(entry);
    S.perfectMemory.push(entry);
    renderMemoryEntries();
    const aEl = document.createElement('div');
    aEl.className = 'msg msg--assistant';
    aEl.innerHTML = `<div class="msg-avatar">🧠</div><div class="msg-inner"><div class="msg-bubble">✅ Gespeichert!</div></div>`;
    msgs.appendChild(aEl);
    msgs.scrollTop = msgs.scrollHeight;
    return;
  }

  if (!apiKey) {
    const aEl = document.createElement('div');
    aEl.className = 'msg msg--assistant';
    aEl.innerHTML = `<div class="msg-avatar">🧠</div><div class="msg-inner"><div class="msg-bubble">Bitte API-Key in den Einstellungen hinterlegen.</div></div>`;
    msgs.appendChild(aEl);
    return;
  }

  // Query with memory context
  const memContext = S.perfectMemory.slice(-20).map(m => `- ${m.text || m.content}`).join('\n');
  const aEl = document.createElement('div');
  aEl.className = 'msg msg--assistant';
  aEl.innerHTML = `<div class="msg-avatar">🧠</div><div class="msg-inner"><div class="msg-bubble streaming-cursor"></div></div>`;
  msgs.appendChild(aEl);
  let full = '';

  window.api.claudeStream(
    {
      agentRole: 'memory',
      messages: [{ role: 'user', content: `Gespeichertes Wissen:\n${memContext || 'Noch nichts gespeichert.'}\n\nFrage: ${text}` }],
      model: 'claude-haiku-4-5-20251001',
      apiKey,
    },
    chunk => {
      full += chunk;
      const b = aEl.querySelector('.msg-bubble');
      if (b) b.textContent = full;
      msgs.scrollTop = msgs.scrollHeight;
    },
    () => { aEl.querySelector('.msg-bubble')?.classList.remove('streaming-cursor'); },
    err => { aEl.querySelector('.msg-bubble').textContent = `Fehler: ${err}`; aEl.querySelector('.msg-bubble')?.classList.remove('streaming-cursor'); }
  );
}

$('btn-add-memory').addEventListener('click', () => {
  const text = prompt('Was soll gespeichert werden?');
  if (!text?.trim()) return;
  const entry = { id: `mem_${Date.now()}`, text: text.trim(), ts: Date.now() };
  window.api.memorySave(entry);
  S.perfectMemory.push(entry);
  renderMemoryEntries();
});

// ── Context menu ──────────────────────────────────────────────
function showCtx(x, y, id, panel) {
  S.ctxTarget = id; S.ctxPanel = panel;
  const m = $('ctx-menu');
  m.style.cssText = `display:block;left:${x}px;top:${y}px`;
  requestAnimationFrame(() => {
    const r = m.getBoundingClientRect();
    if (r.right > window.innerWidth)  m.style.left = (x - r.width)  + 'px';
    if (r.bottom > window.innerHeight) m.style.top  = (y - r.height) + 'px';
  });
}

$('ctx-reload').addEventListener('click', () => { if (S.ctxTarget) window.api.reloadView(S.ctxPanel, S.ctxTarget); hideCtx(); });
$('ctx-logout').addEventListener('click', () => { if (S.ctxTarget) window.api.logoutAccount(S.ctxPanel, S.ctxTarget); hideCtx(); });
$('ctx-remove').addEventListener('click', () => {
  if (!S.ctxTarget) return;
  if (S.ctxPanel === 'center') removeConnector(S.ctxTarget);
  else removeRightApp(S.ctxTarget);
  hideCtx();
});
function hideCtx() { $('ctx-menu').style.display = 'none'; S.ctxTarget = null; S.ctxPanel = null; }
document.addEventListener('click', hideCtx);

// ── Keyboard ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $('modal-overlay').style.display     = 'none';
    $('proj-modal-overlay').style.display= 'none';
    $('settings-overlay').style.display  = 'none';
  }
});

// ── Utils ─────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}
function autoResize(e) {
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px';
}
function agentLabel(a) {
  return { architect:'Architect', researcher:'Researcher', coder:'Coder', writer:'Writer', analyst:'Analyst', memory:'Memory' }[a] || a;
}
function agentEmoji(a) {
  return { architect:'🏗', researcher:'🔍', coder:'💻', writer:'✍', analyst:'📊', memory:'🧠' }[a] || '⚡';
}
function catLabel(c) {
  return { cloud:'☁ Cloud', comms:'💬 Komm.', dev:'⚡ Dev', tool:'🔧 Tools', ai:'🤖 KI', social:'🌐 Social', custom:'⚙ Custom' }[c] || c;
}
function modelShort(m) {
  return { 'claude-opus-4-8':'Opus 4.8', 'claude-sonnet-4-6':'Sonnet 4.6', 'claude-haiku-4-5-20251001':'Haiku 4.5' }[m] || m;
}
function relDate(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d === 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d}d`;
}
