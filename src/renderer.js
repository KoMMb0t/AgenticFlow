// AgenticFlow v0.2 — Renderer

// ── State ────────────────────────────────────────────────────
const S = {
  leftCollapsed:   false,
  rightCollapsed:  false,
  connections:     [],     // all connected apps/clouds/agents
  activeCenterId:  null,
  projects:        [],
  activeProjectId: null,
  apiKeys:         {},
  chatMessages:    [],
  perfectMemory:   [],
  activeAgent:     'architect',
  rightTab:        'links',
  currentView:     'home',
  connTemplates:   [],
  rightTemplates:  [],
  // modal
  cmMode:   null,   // 'cloud'|'service'|'agent'|'any'
  cmTpl:    null,
  cmFilter: 'all',
  // ctx menu
  ctxId:    null,
  ctxPanel: null,
};

const $ = id => document.getElementById(id);

// ── Init ─────────────────────────────────────────────────────
window.api.onAppReady(data => {
  Object.assign(S, {
    leftCollapsed:   data.leftCollapsed,
    rightCollapsed:  data.rightCollapsed,
    // merge connectors + rightApps into one unified "connections" list
    connections:     [...(data.connectors || []), ...(data.rightApps || [])],
    activeCenterId:  data.activeCenterId,
    projects:        data.projects     || [],
    activeProjectId: data.activeProjectId,
    apiKeys:         data.apiKeys      || {},
    chatMessages:    data.chatHistory  || [],
    perfectMemory:   data.perfectMemory|| [],
    connTemplates:   data.connTemplates || [],
    rightTemplates:  data.rightTemplates || [],
  });

  applyPanels();
  renderLeft();
  renderAllChips();
  renderLinkCards();
  renderMemoryEntries();
  renderTabs();

  if (S.apiKeys.claude)
    $('inp-claude-key').value = '••••••••' + S.apiKeys.claude.slice(-4);

  if (S.activeProjectId) openProject(S.projects.find(p => p.id === S.activeProjectId));
  else showView('home');

  sendLayout();

  // Netzwerk-Panel nach kurzem Delay laden
  setTimeout(loadLocalNetwork, 1200);
});

window.api.onWindowResized(sendLayout);

// ── Layout ───────────────────────────────────────────────────
function sendLayout() {
  requestAnimationFrame(() => {
    const cp = $('center-panel').getBoundingClientRect();
    const rp = $('right-panel').getBoundingClientRect();
    const hasOverlay = S.activeCenterId && $('conn-overlay-bar').style.display !== 'none';
    const oH = hasOverlay ? 38 : 0;

    window.api.updateLayout({
      center: S.activeCenterId ? {
        x: Math.round(cp.left), y: Math.round(cp.top + oH),
        width: Math.round(cp.width), height: Math.round(cp.height - oH),
      } : null,
      right: null, // right panel is always HTML (link cards), no BrowserView
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
function showView(v) {
  S.currentView = v;
  $('view-home').style.display    = v === 'home'    ? 'flex'  : 'none';
  $('view-project').style.display = v === 'project' ? 'flex'  : 'none';
  $('view-chat').style.display    = v === 'chat'    ? 'flex'  : 'none';
  if (v === 'home') renderProjects();
}

// ── Left sidebar ──────────────────────────────────────────────
function renderLeft() {
  // Konnektoren = alles außer KI-Agenten zusammen
  const conns  = S.connections.filter(c => c.cat !== 'ai');
  const agents = S.connections.filter(c => c.cat === 'ai');

  renderConnList($('conn-list-all'),   conns);
  renderConnList($('agent-conn-list'), agents);
}

// Add-button in left sidebar header — wired up in initUI() below

function renderConnList(container, list) {
  if (!list.length) { container.innerHTML = `<div class="empty-hint">Unten im Chat verbinden ↓</div>`; return; }
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
      <button class="conn-act" data-a="open" title="Öffnen">↗</button>
      <button class="conn-act danger" data-a="remove" title="Entfernen">✕</button>
    </div>`;
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'open')   { openConnector(c.instanceId); return; }
    if (a === 'remove') { removeConnection(c.instanceId); return; }
    openConnector(c.instanceId);
  });
  el.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e.clientX, e.clientY, c.instanceId); });
  return el;
}

// ── App Chips (in chat footer) ────────────────────────────────
function renderAllChips() {
  renderChipsIn($('app-chips'),    () => S.currentView === 'project');
  renderChipsIn($('app-chips-sa'), () => S.currentView === 'chat');
}

function renderChipsIn(container, _cond) {
  if (!container) return;
  container.innerHTML = '';
  if (!S.connections.length) {
    container.innerHTML = `<span style="font-size:11px;color:var(--txt-d);opacity:.6">Noch keine Apps</span>`;
    return;
  }
  S.connections.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'app-conn-chip' + (S.activeCenterId === c.instanceId ? ' active' : '');
    chip.dataset.id = c.instanceId;
    chip.title = `${c.name} — ${c.label}`;
    chip.innerHTML = `<span class="chip-dot" style="background:${c.color}"></span>${c.icon} ${esc(c.name)} <span style="opacity:.6;font-size:10px">${esc(c.label)}</span>`;
    chip.addEventListener('click', () => openConnector(c.instanceId));
    chip.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e.clientX, e.clientY, c.instanceId); });
    container.appendChild(chip);
  });
}

// ── Link Cards (right panel) ──────────────────────────────────
function renderLinkCards() {
  const list  = $('link-list');
  const empty = $('link-empty');
  list.innerHTML = '';

  if (!S.connections.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  S.connections.forEach(c => {
    const card = document.createElement('div');
    card.className = 'link-card' + (S.activeCenterId === c.instanceId ? ' active' : '');
    card.dataset.id = c.instanceId;
    card.innerHTML = `
      <div class="lc-status-dot"></div>
      <div class="lc-top">
        <div class="lc-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</div>
        <div class="lc-info">
          <div class="lc-name">${esc(c.name)}</div>
          <div class="lc-label">${esc(c.label)}</div>
        </div>
        <button class="lc-open" data-id="${c.instanceId}">↗ Öffnen</button>
      </div>
      <div class="lc-actions">
        <button class="lc-btn" data-a="reload">↺ Neu laden</button>
        <button class="lc-btn" data-a="logout">⏻ Abmelden</button>
        <button class="lc-btn danger" data-a="remove">✕</button>
      </div>`;

    card.querySelector('.lc-open').addEventListener('click', e => {
      e.stopPropagation();
      openConnector(c.instanceId);
    });
    card.querySelector('[data-a="reload"]').addEventListener('click', () => {
      const panel = c.cat === 'ai' || c.cat === 'social' || c.cat === 'comms' ? 'right' : 'center';
      window.api.reloadView(panel, c.instanceId);
    });
    card.querySelector('[data-a="logout"]').addEventListener('click', () => {
      const panel = c.cat === 'ai' || c.cat === 'social' || c.cat === 'comms' ? 'right' : 'center';
      window.api.logoutAccount(panel, c.instanceId);
    });
    card.querySelector('[data-a="remove"]').addEventListener('click', () => removeConnection(c.instanceId));
    card.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e.clientX, e.clientY, c.instanceId); });

    list.appendChild(card);
  });
}

// ── Center tabs ───────────────────────────────────────────────
function renderTabs() {
  document.querySelectorAll('.tab[data-type="conn"]').forEach(t => t.remove());
  S.connections.forEach(c => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (S.activeCenterId === c.instanceId ? ' tab--active' : '');
    tab.dataset.type = 'conn'; tab.dataset.id = c.instanceId;
    tab.innerHTML = `<span>${c.icon}</span><span class="tl">${esc(c.name)}</span><button class="tab-x">✕</button>`;
    tab.querySelector('.tab-x').addEventListener('click', e => { e.stopPropagation(); closeConnector(c.instanceId); });
    tab.addEventListener('click', e => { if (!e.target.classList.contains('tab-x')) openConnector(c.instanceId); });
    $('center-tabs').appendChild(tab);
  });
}

// ── Open / Close connector ────────────────────────────────────
function openConnector(id) {
  const c = S.connections.find(x => x.instanceId === id);
  if (!c) return;

  // AI/social agents open in right panel via BrowserView
  // Cloud/service open in center panel via BrowserView
  const panel = (c.cat === 'ai' || c.cat === 'comms' || c.cat === 'social') ? 'right' : 'center';

  if (panel === 'center') {
    S.activeCenterId = id;
    window.api.switchCenter(id);
    showOverlayBar(c);
  } else {
    // For right-panel apps: just open directly (existing BrowserView logic)
    S.activeCenterId = id;
    window.api.switchRight(id);
    showOverlayBar(c);
  }

  // Update UI
  document.querySelectorAll('.conn-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  document.querySelectorAll('.app-conn-chip').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  document.querySelectorAll('.link-card').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('tab--active', t.dataset.id === id));
  sendLayout();
}

function closeConnector(id) {
  if (S.activeCenterId === id) {
    S.activeCenterId = null;
    window.api.switchCenter(null);
    hideOverlayBar();
    document.querySelectorAll('.conn-item, .app-conn-chip, .link-card').forEach(el => {
      if (el.dataset.id === id) el.classList.remove('active');
    });
    sendLayout();
  }
}

function showOverlayBar(c) {
  const bar = $('conn-overlay-bar');
  bar.style.display = 'flex';
  $('cob-icon').textContent  = c.icon;
  $('cob-name').textContent  = c.name;
  $('cob-label').textContent = c.label;
}
function hideOverlayBar() { $('conn-overlay-bar').style.display = 'none'; }

$('cob-close').addEventListener('click', () => { closeConnector(S.activeCenterId); });
$('cob-reload').addEventListener('click', () => { if (S.activeCenterId) window.api.reloadView('center', S.activeCenterId); });
$('cob-logout').addEventListener('click', () => { if (S.activeCenterId) window.api.logoutAccount('center', S.activeCenterId); });

// ── Remove connection ─────────────────────────────────────────
function removeConnection(id) {
  const c = S.connections.find(x => x.instanceId === id);
  if (!c) return;
  if (c.instanceId.startsWith('conn_')) window.api.removeConnector(id);
  else window.api.removeRightApp(id);

  S.connections = S.connections.filter(x => x.instanceId !== id);
  if (S.activeCenterId === id) { S.activeCenterId = null; hideOverlayBar(); }

  renderLeft(); renderAllChips(); renderLinkCards(); renderTabs();
  updateSettingsConnList();
  sendLayout();
}

window.api.onConnectorRemoved(id => { S.connections = S.connections.filter(c => c.instanceId !== id); if (S.activeCenterId === id) hideOverlayBar(); renderLeft(); renderAllChips(); renderLinkCards(); renderTabs(); });
window.api.onRightAppRemoved(id => { S.connections = S.connections.filter(c => c.instanceId !== id); if (S.activeCenterId === id) hideOverlayBar(); renderLeft(); renderAllChips(); renderLinkCards(); renderTabs(); });

// ── Right tabs ────────────────────────────────────────────────
document.querySelectorAll('.rtab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    S.rightTab = tab;
    document.querySelectorAll('.rtab').forEach(b => b.classList.toggle('rtab--active', b.dataset.tab === tab));
    $('tab-links-view').style.display  = tab === 'links'  ? 'flex' : 'none';
    $('tab-memory-view').style.display = tab === 'memory' ? 'flex' : 'none';
    $('tab-links-view').style.flexDirection = 'column';
  });
});

// ── Projects ──────────────────────────────────────────────────
function renderProjects() {
  const grid = $('project-grid');
  grid.innerHTML = '';
  const hw = $('home-welcome');
  if (!S.projects.length) { hw.style.display = 'flex'; return; }
  hw.style.display = 'none';
  S.projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'proj-card';
    card.innerHTML = `
      <div class="proj-card-icon">🏗</div>
      <div class="proj-card-name">${esc(p.name)}</div>
      <div class="proj-card-desc">${esc(p.description || '')}</div>
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

  const msgs = $('proj-messages');
  msgs.innerHTML = '';
  (p.chatHistory || []).forEach(m => appendProjMsg(m, false));
  if (p.chatHistory?.length) msgs.scrollTop = msgs.scrollHeight;

  document.querySelectorAll('.tab[data-type="project"]').forEach(t => t.remove());
  $('tab-home').classList.remove('tab--active');
  const tab = document.createElement('button');
  tab.className = 'tab tab--active'; tab.dataset.type = 'project'; tab.dataset.id = p.id;
  tab.innerHTML = `<span>🏗</span><span class="tl">${esc(p.name)}</span><button class="tab-x">✕</button>`;
  tab.querySelector('.tab-x').addEventListener('click', () => { tab.remove(); goHome(); });
  tab.addEventListener('click', e => { if (!e.target.classList.contains('tab-x')) openProject(p); });
  $('center-tabs').insertBefore(tab, $('tab-home').nextSibling);
}

function goHome() { S.activeProjectId = null; window.api.setActiveProject(null); showView('home'); }

$('btn-back-home').addEventListener('click', goHome);
$('tab-home').addEventListener('click', () => { if (S.currentView !== 'home') goHome(); });
$('btn-new-project').addEventListener('click', openProjModal);
$('btn-new-project-2').addEventListener('click', openProjModal);

function openProjModal() {
  $('pm-name').value = ''; $('pm-desc').value = '';
  $('proj-modal-overlay').style.display = 'flex';
  setTimeout(() => $('pm-name').focus(), 50);
}
$('pm-close').addEventListener('click',   () => { $('proj-modal-overlay').style.display = 'none'; });
$('pm-cancel').addEventListener('click',  () => { $('proj-modal-overlay').style.display = 'none'; });
$('pm-create').addEventListener('click', async () => {
  const name = $('pm-name').value.trim();
  if (!name) { $('pm-name').focus(); return; }
  const p = await window.api.projectCreate({ name, description: $('pm-desc').value.trim(), model: $('pm-model').value });
  S.projects.push(p);
  $('proj-modal-overlay').style.display = 'none';
  openProject(p);
});

// ── Agent tabs ────────────────────────────────────────────────
document.querySelectorAll('.agent-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.agent-tab').forEach(b => b.classList.remove('agent-tab--active'));
    btn.classList.add('agent-tab--active');
    S.activeAgent = btn.dataset.agent;
  });
});

// ── Project chat (Architect + streaming) ─────────────────────
$('proj-send-btn').addEventListener('click', sendProjMsg);
$('proj-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendProjMsg(); } });
$('proj-input').addEventListener('input', autoResize);

async function sendProjMsg() {
  const text = $('proj-input').value.trim();
  if (!text) return;
  const apiKey = S.apiKeys.claude;
  if (!apiKey) { $('settings-overlay').style.display = 'flex'; return; }

  const uMsg = { role: 'user', content: text, agent: S.activeAgent, ts: Date.now() };
  appendProjMsg(uMsg);
  window.api.projectAddMessage(S.activeProjectId, uMsg);
  $('proj-input').value = ''; $('proj-input').style.height = 'auto';

  const proj    = S.projects.find(p => p.id === S.activeProjectId);
  const history = (proj?.chatHistory || []).filter(m => m.role === 'user' || m.role === 'assistant').slice(-20).map(m => ({ role: m.role, content: m.content }));

  setDot(S.activeAgent, 'working');
  setStatus('working', `${agentEmoji(S.activeAgent)} ${agentLabel(S.activeAgent)} arbeitet…`);

  const el  = appendProjMsg({ role: 'assistant', content: '', agent: S.activeAgent, ts: Date.now() }, true, true);
  let full  = '';

  window.api.claudeStream(
    { agentRole: S.activeAgent, messages: [...history, { role: 'user', content: text }], model: $('architect-model').value, apiKey },
    chunk => {
      full += chunk;
      const b = el.querySelector('.msg-bubble');
      if (b) { b.textContent = full; b.classList.add('streaming'); }
      $('proj-messages').scrollTop = $('proj-messages').scrollHeight;
    },
    () => {
      el.querySelector('.msg-bubble')?.classList.remove('streaming');
      const m = { role: 'assistant', content: full, agent: S.activeAgent, ts: Date.now() };
      window.api.projectAddMessage(S.activeProjectId, m);
      setDot(S.activeAgent, 'done');
      setStatus('idle', 'bereit');
      handleDelegation(full);
    },
    err => {
      el.querySelector('.msg-bubble').textContent = `Fehler: ${err}`;
      el.querySelector('.msg-bubble')?.classList.remove('streaming');
      setDot(S.activeAgent, 'idle'); setStatus('error', 'Fehler');
    }
  );
}

function handleDelegation(text) {
  const rx = /\[DELEGATE:(\w+):([^\]]+)\]/g;
  let m;
  while ((m = rx.exec(text)) !== null)
    appendProjMsg({ role: 'system', content: `🏗 Architect → ${agentLabel(m[1])}: "${m[2]}"`, ts: Date.now() });
}

function appendProjMsg(msg, scroll = true, ret = false) {
  const area = $('proj-messages');
  const el   = document.createElement('div');
  if (msg.role === 'system') {
    el.className = 'msg msg--system';
    el.innerHTML = `<div class="msg-bubble">${esc(msg.content)}</div>`;
  } else {
    el.className = `msg msg--${msg.role === 'user' ? 'user' : 'assistant'}`;
    const av   = msg.role === 'user' ? 'Du' : agentEmoji(msg.agent);
    const lbl  = msg.role !== 'user' ? `<div class="msg-agent">${agentLabel(msg.agent || 'architect')}</div>` : '';
    const time = new Date(msg.ts).toLocaleTimeString('de', { hour:'2-digit', minute:'2-digit' });
    el.innerHTML = `
      <div class="msg-avatar">${av}</div>
      <div class="msg-inner">${lbl}<div class="msg-bubble">${esc(msg.content)}</div><div class="msg-time">${time}</div></div>`;
  }
  area.appendChild(el);
  if (scroll) area.scrollTop = area.scrollHeight;
  return ret ? el : undefined;
}

function setDot(agent, state) {
  const dot = document.querySelector(`.agent-tab[data-agent="${agent}"] .at-dot`);
  if (dot) dot.className = `at-dot dot-${state}`;
}
function setStatus(cls, txt) {
  const el = $('proj-status');
  el.textContent = txt;
  el.className = `status-badge status-${cls}`;
}

// ── Standalone chat ───────────────────────────────────────────
$('send-btn').addEventListener('click', sendChatMsg);
$('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg(); } });
$('chat-input').addEventListener('input', autoResize);

async function sendChatMsg() {
  const text = $('chat-input').value.trim();
  if (!text) return;
  const apiKey = S.apiKeys.claude;
  if (!apiKey) { $('settings-overlay').style.display = 'flex'; return; }

  $('chat-messages').querySelector('.chat-welcome')?.remove();
  const uMsg = { role: 'user', content: text, ts: Date.now() };
  S.chatMessages.push(uMsg); window.api.saveChatMessage(uMsg);
  appendChatMsg(uMsg);
  $('chat-input').value = ''; $('chat-input').style.height = 'auto';

  const el  = appendChatMsg({ role: 'assistant', content: '', ts: Date.now() }, true, true);
  let full  = '';
  const hist = S.chatMessages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-20).map(m => ({ role: m.role, content: m.content }));

  window.api.claudeStream(
    { agentRole: 'architect', messages: hist, model: $('model-select').value, apiKey },
    chunk => { full += chunk; const b = el.querySelector('.msg-bubble'); if (b) { b.textContent = full; b.classList.add('streaming'); } $('chat-messages').scrollTop = $('chat-messages').scrollHeight; },
    () => { el.querySelector('.msg-bubble')?.classList.remove('streaming'); const m = { role:'assistant', content:full, ts:Date.now() }; S.chatMessages.push(m); window.api.saveChatMessage(m); },
    err => { el.querySelector('.msg-bubble').textContent = `Fehler: ${err}`; el.querySelector('.msg-bubble')?.classList.remove('streaming'); }
  );
}

function appendChatMsg(msg, scroll = true, ret = false) {
  const area = $('chat-messages');
  const el   = document.createElement('div');
  el.className = `msg msg--${msg.role}`;
  const time = new Date(msg.ts).toLocaleTimeString('de', { hour:'2-digit', minute:'2-digit' });
  el.innerHTML = `<div class="msg-avatar">${msg.role === 'user' ? 'Du' : '⚡'}</div><div class="msg-inner"><div class="msg-bubble">${esc(msg.content)}</div><div class="msg-time">${time}</div></div>`;
  area.appendChild(el);
  if (scroll) area.scrollTop = area.scrollHeight;
  return ret ? el : undefined;
}

// ── Connect Modal ─────────────────────────────────────────────
function openConnectModal(mode) {
  S.cmMode = mode; S.cmTpl = null; S.cmFilter = 'all';
  $('cm-step-1').style.display = 'block';
  $('cm-step-2').style.display = 'none';
  $('cm-label').value = ''; $('cm-url').value = '';

  // Combine all templates
  const allTpls = [...(S.connTemplates || []), ...(S.rightTemplates || [])];
  $('cm-title').textContent = 'App / Cloud / Agent verbinden';

  // Filter chips
  const cats = [...new Set(allTpls.map(t => t.cat))];
  $('cm-filter').innerHTML = `<button class="filter-chip active" data-cat="all">Alle</button>` +
    cats.map(c => `<button class="filter-chip" data-cat="${c}">${catLabel(c)}</button>`).join('');
  $('cm-filter').querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $('cm-filter').querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); S.cmFilter = btn.dataset.cat;
      renderCmGrid(allTpls);
    });
  });

  renderCmGrid(allTpls);
  $('connect-modal-overlay').style.display = 'flex';
}

function renderCmGrid(templates) {
  const filtered = S.cmFilter === 'all' ? templates : templates.filter(t => t.cat === S.cmFilter);
  $('cm-grid').innerHTML = '';
  filtered.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tpl-card';
    card.innerHTML = `<div class="tpl-ico" style="background:${t.color}22;color:${t.color}">${t.icon}</div><div class="tpl-name">${esc(t.name)}</div>`;
    card.addEventListener('click', () => selectCmTpl(t));
    $('cm-grid').appendChild(card);
  });
}

function selectCmTpl(t) {
  S.cmTpl = t;
  $('cm-step-1').style.display = 'none'; $('cm-step-2').style.display = 'flex';
  $('cm-preview').innerHTML = `<div class="fp-ico" style="background:${t.color}22;color:${t.color}">${t.icon}</div><div class="fp-name">${esc(t.name)}</div>`;
  $('cm-url-group').style.display = (!t.url || t.id === 'custom') ? 'block' : 'none';
  $('cm-label').focus();
}

$('btn-add-connection').addEventListener('click',    () => openConnectModal('any'));
$('btn-add-conn-sa').addEventListener('click',       () => openConnectModal('any'));
$('cm-close').addEventListener('click', closeCmModal);
$('cm-back').addEventListener('click',  () => { $('cm-step-1').style.display = 'block'; $('cm-step-2').style.display = 'none'; S.cmTpl = null; });
$('connect-modal-overlay').addEventListener('click', e => { if (e.target === $('connect-modal-overlay')) closeCmModal(); });

$('cm-create').addEventListener('click', async () => {
  if (!S.cmTpl) return;
  const label = $('cm-label').value.trim() || 'Account';
  const url   = $('cm-url').value.trim();
  const existing = S.connections.filter(x => x.templateId === S.cmTpl.id).length;

  // AI/social → right app; everything else → left connector
  const isAgent = ['ai','social','comms'].includes(S.cmTpl.cat);
  let conn;
  if (isAgent) {
    conn = await window.api.addRightApp({ templateId: S.cmTpl.id, label, customUrl: url, accountIndex: existing + 1 });
  } else {
    conn = await window.api.addConnector({ templateId: S.cmTpl.id, label, customUrl: url, accountIndex: existing + 1 });
  }
  if (conn) {
    S.connections.push(conn);
    renderLeft(); renderAllChips(); renderLinkCards(); renderTabs();
    updateSettingsConnList();
  }
  closeCmModal();
});

function closeCmModal() { $('connect-modal-overlay').style.display = 'none'; S.cmTpl = null; }

// ── Settings ──────────────────────────────────────────────────
$('btn-settings').addEventListener('click',     () => { updateSettingsConnList(); $('settings-overlay').style.display = 'flex'; });
$('btn-proj-settings').addEventListener('click',() => { updateSettingsConnList(); $('settings-overlay').style.display = 'flex'; });
$('settings-close').addEventListener('click',   () => { $('settings-overlay').style.display = 'none'; });
$('settings-overlay').addEventListener('click', e => { if (e.target === $('settings-overlay')) $('settings-overlay').style.display = 'none'; });

$('save-claude-key').addEventListener('click', () => {
  const key = $('inp-claude-key').value.trim();
  if (!key || key.startsWith('••')) { $('api-key-status').textContent = ''; return; }
  S.apiKeys.claude = key;
  window.api.saveApiKey('claude', key);
  $('inp-claude-key').value = '••••••••' + key.slice(-4);
  $('api-key-status').textContent = '✅ API-Key gespeichert';
  setTimeout(() => { $('settings-overlay').style.display = 'none'; }, 800);
});

function updateSettingsConnList() {
  const list = $('settings-conn-list');
  if (!list) return;
  if (!S.connections.length) { list.innerHTML = `<div class="empty-hint">Noch keine Verbindungen.</div>`; return; }
  list.innerHTML = '';
  S.connections.forEach(c => {
    const el = document.createElement('div');
    el.className = 'settings-conn-item';
    el.innerHTML = `
      <div class="conn-icon" style="background:${c.color}22;color:${c.color};width:24px;height:24px;border-radius:6px;font-size:13px;display:flex;align-items:center;justify-content:center">${c.icon}</div>
      <span>${esc(c.name)} — ${esc(c.label)}</span>
      <button class="settings-conn-remove" data-id="${c.instanceId}">✕</button>`;
    el.querySelector('.settings-conn-remove').addEventListener('click', () => {
      removeConnection(c.instanceId);
      updateSettingsConnList();
    });
    list.appendChild(el);
  });
}

// ── Perfect Memory ────────────────────────────────────────────
$('memory-send-btn').addEventListener('click', sendMemMsg);
$('memory-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMemMsg(); } });
$('memory-input').addEventListener('input', autoResize);
$('btn-add-memory').addEventListener('click', () => {
  const text = prompt('Was speichern?');
  if (!text?.trim()) return;
  const entry = { id: `mem_${Date.now()}`, text: text.trim(), ts: Date.now() };
  window.api.memorySave(entry); S.perfectMemory.push(entry); renderMemoryEntries();
});

async function sendMemMsg() {
  const text = $('memory-input').value.trim();
  if (!text) return;
  $('memory-messages').querySelector('.memory-welcome')?.remove();
  const isSave = /^(speicher|merke|notier|save|remember)/i.test(text);

  const uEl = document.createElement('div');
  uEl.className = 'msg msg--user';
  uEl.innerHTML = `<div class="msg-avatar" style="font-size:11px">Du</div><div class="msg-inner"><div class="msg-bubble">${esc(text)}</div></div>`;
  $('memory-messages').appendChild(uEl);
  $('memory-input').value = ''; $('memory-input').style.height = 'auto';

  if (isSave) {
    const entry = { id: `mem_${Date.now()}`, text, ts: Date.now() };
    window.api.memorySave(entry); S.perfectMemory.push(entry); renderMemoryEntries();
    const aEl = document.createElement('div');
    aEl.className = 'msg msg--assistant';
    aEl.innerHTML = `<div class="msg-avatar">🧠</div><div class="msg-inner"><div class="msg-bubble">✅ Gespeichert!</div></div>`;
    $('memory-messages').appendChild(aEl);
    return;
  }

  const apiKey = S.apiKeys.claude;
  if (!apiKey) { const aEl = document.createElement('div'); aEl.className = 'msg msg--assistant'; aEl.innerHTML = `<div class="msg-avatar">🧠</div><div class="msg-inner"><div class="msg-bubble">Bitte API-Key in Einstellungen.</div></div>`; $('memory-messages').appendChild(aEl); return; }

  const memCtx = S.perfectMemory.slice(-20).map(m => `- ${m.text}`).join('\n') || 'Nichts gespeichert.';
  const aEl = document.createElement('div');
  aEl.className = 'msg msg--assistant';
  aEl.innerHTML = `<div class="msg-avatar">🧠</div><div class="msg-inner"><div class="msg-bubble streaming"></div></div>`;
  $('memory-messages').appendChild(aEl);
  let full = '';

  window.api.claudeStream(
    { agentRole: 'memory', messages: [{ role: 'user', content: `Wissen:\n${memCtx}\n\nFrage: ${text}` }], model: 'claude-haiku-4-5-20251001', apiKey },
    chunk => { full += chunk; const b = aEl.querySelector('.msg-bubble'); if (b) b.textContent = full; $('memory-messages').scrollTop = $('memory-messages').scrollHeight; },
    () => { aEl.querySelector('.msg-bubble')?.classList.remove('streaming'); },
    err => { aEl.querySelector('.msg-bubble').textContent = `Fehler: ${err}`; aEl.querySelector('.msg-bubble')?.classList.remove('streaming'); }
  );
}

function renderMemoryEntries() {
  const el = $('memory-entries');
  $('mem-count').textContent = S.perfectMemory.length;
  el.innerHTML = '';
  if (!S.perfectMemory.length) { el.innerHTML = `<div class="empty-hint">Noch nichts gespeichert.</div>`; return; }
  [...S.perfectMemory].reverse().forEach(m => {
    const div = document.createElement('div');
    div.className = 'mem-entry';
    div.innerHTML = `<div class="mem-entry-text">${esc(m.text||m.content||'')}</div><div class="mem-entry-time">${new Date(m.ts).toLocaleString('de')}</div><button class="mem-del" data-id="${m.id}">✕</button>`;
    div.querySelector('.mem-del').addEventListener('click', () => { window.api.memoryDelete(m.id); S.perfectMemory = S.perfectMemory.filter(x => x.id !== m.id); renderMemoryEntries(); });
    el.appendChild(div);
  });
}

// ── Context menu ──────────────────────────────────────────────
function showCtx(x, y, id) {
  S.ctxId = id;
  const m = $('ctx-menu');
  m.style.cssText = `display:block;left:${x}px;top:${y}px`;
  requestAnimationFrame(() => {
    const r = m.getBoundingClientRect();
    if (r.right > window.innerWidth)  m.style.left = (x - r.width)  + 'px';
    if (r.bottom > window.innerHeight) m.style.top  = (y - r.height) + 'px';
  });
}
$('ctx-open').addEventListener('click',   () => { if (S.ctxId) openConnector(S.ctxId); hideCtx(); });
$('ctx-reload').addEventListener('click', () => { if (S.ctxId) window.api.reloadView('center', S.ctxId); hideCtx(); });
$('ctx-logout').addEventListener('click', () => { if (S.ctxId) window.api.logoutAccount('center', S.ctxId); hideCtx(); });
$('ctx-remove').addEventListener('click', () => { if (S.ctxId) removeConnection(S.ctxId); hideCtx(); });
function hideCtx() { $('ctx-menu').style.display = 'none'; S.ctxId = null; }
document.addEventListener('click', hideCtx);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $('connect-modal-overlay').style.display = 'none';
    $('proj-modal-overlay').style.display    = 'none';
    $('settings-overlay').style.display      = 'none';
  }
});

// ── Utils ─────────────────────────────────────────────────────
// ── LOCAL NETWORK PANEL ───────────────────────────────────────

async function loadLocalNetwork() {
  loadWifi();
  loadNetworkDevices();
  loadBluetooth();
}

async function loadWifi() {
  const info = await window.api.getWifiInfo().catch(() => ({ name: 'Fehler', strength: 0 }));
  const el   = $('wifi-info');
  if (!el) return;

  const bars  = Math.round((info.strength / 100) * 4);
  const dot   = info.strength > 0 ? 'dot-online' : 'dot-offline';

  el.innerHTML = `
    <span class="local-dot ${dot}"></span>
    <span class="local-name">${esc(info.name)}</span>
    <span class="wifi-bar">
      <span class="${bars >= 1 ? 'lit' : ''}"></span>
      <span class="${bars >= 2 ? 'lit' : ''}"></span>
      <span class="${bars >= 3 ? 'lit' : ''}"></span>
      <span class="${bars >= 4 ? 'lit' : ''}"></span>
    </span>
    <span class="local-meta">${info.strength > 0 ? info.strength + '%' : ''}</span>`;
}

async function loadNetworkDevices() {
  const devices = await window.api.scanNetwork().catch(() => []);
  const list    = $('network-devices');
  if (!list) return;

  if (!devices.length) {
    list.innerHTML = `<div class="empty-hint" style="padding:4px 14px">Keine Geräte gefunden</div>`;
    return;
  }

  list.innerHTML = '';
  // Gerät-Typ aus IP ableiten (rudimentär)
  devices.forEach(d => {
    const icon = guessDeviceIcon(d.ip, d.mac);
    const el   = document.createElement('div');
    el.className = 'local-device';
    el.title = `MAC: ${d.mac}`;
    el.innerHTML = `
      <span class="local-icon">${icon}</span>
      <span class="local-name">${d.ip}</span>
      <span class="local-type">${d.mac.slice(0,8)}</span>`;
    list.appendChild(el);
  });
}

async function loadBluetooth() {
  await loadBleDevices();
}

// ── BLE ────────────────────────────────────────────────────
let bleLoginPairs = [];

async function loadBleAdapter() {
  const info = await window.api.bleAdapterInfo().catch(() => ({ name: 'BT-Adapter', status: 'Unknown' }));
  const row  = $('ble-adapter-row');
  const nm   = $('ble-adapter-name');
  const btn  = $('ble-power-btn');
  if (!row) return;
  const on = info.status === 'OK';
  row.querySelector('.local-dot').className = `local-dot ${on ? 'dot-online' : 'dot-offline'}`;
  if (nm) nm.textContent = info.name;
  if (btn) btn.classList.toggle('on', on);
}

async function loadBleDevices() {
  await loadBleAdapter();
  const list    = $('ble-devices');
  if (!list) return;
  list.innerHTML = `<div class="empty-hint" style="padding:4px 14px">Scannen…</div>`;

  const [devices, loginPairs] = await Promise.all([
    window.api.bleGetDevices().catch(() => []),
    window.api.bleGetLoginPairs().catch(() => []),
  ]);
  bleLoginPairs = loginPairs;

  if (!devices.length) {
    list.innerHTML = `<div class="empty-hint" style="padding:4px 14px">Keine BT-Geräte</div>`;
    return;
  }

  list.innerHTML = '';
  devices.forEach(d => {
    const isLogin = loginPairs.some(p => p.deviceId === d.id);
    const el      = document.createElement('div');
    el.className  = `ble-device${isLogin ? ' login' : ''}`;
    el.title      = d.id;
    el.innerHTML  = `
      <span class="ble-icon">${d.icon || '🔵'}</span>
      <div class="ble-info">
        <div class="ble-name">${esc(d.name)}</div>
        <div class="ble-meta">${d.isBle ? 'BLE' : 'BT Classic'}${isLogin ? ' · 🔑 Login' : ''}</div>
      </div>
      <button class="ble-pair-btn ${isLogin ? 'as-login' : ''}"
        data-id="${d.id}" data-name="${esc(d.name)}" data-type="${d.type}">
        ${isLogin ? '🔑 Login' : '+ Pairen'}
      </button>`;

    el.querySelector('.ble-pair-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (isLogin) openBleLoginPanel();
      else pairDeviceForLogin(d);
    });
    list.appendChild(el);
  });
}

async function pairDeviceForLogin(device) {
  await window.api.blePairForLogin({
    deviceId:   device.id,
    deviceName: device.name,
    deviceType: device.type,
  });
  showNotif(`✅ ${device.name} als Login-Gerät gespeichert`);
  loadBleDevices();
  loadBleLoginPanel();
}

// ── BLE Login Panel ───────────────────────────────────────
function openBleLoginPanel() {
  $('ble-login-panel').style.display = 'flex';
  loadBleLoginPanel();
}

async function loadBleLoginPanel() {
  const [pairs, allDevices] = await Promise.all([
    window.api.bleGetLoginPairs().catch(() => []),
    window.api.bleGetDevices().catch(() => []),
  ]);
  bleLoginPairs = pairs;

  // Paired devices
  const pairedList = $('blp-paired-list');
  if (pairedList) {
    pairedList.innerHTML = '';
    if (!pairs.length) {
      pairedList.innerHTML = `<div class="empty-hint">Noch keine Login-Geräte gepaired.</div>`;
    } else {
      pairs.forEach(p => {
        const el = document.createElement('div');
        el.className = 'blp-device is-login';
        const icon = {watch:'⌚',headphone:'🎧',phone:'📱',keyboard:'⌨',mouse:'🖱',speaker:'🔊',computer:'💻',ble:'📡',device:'🔵'}[p.deviceType] || '🔵';
        el.innerHTML = `
          <span class="blp-device-icon">${icon}</span>
          <div class="blp-device-info">
            <div class="blp-device-name">${esc(p.deviceName)}</div>
            <div class="blp-device-sub">Gepairt ${relDate(p.pairedAt)}</div>
          </div>
          <button class="blp-action check" data-check="${p.deviceId}">🔍 Check</button>
          <button class="blp-action unpair" data-unpair="${p.deviceId}">Entfernen</button>`;

        el.querySelector('[data-check]').addEventListener('click', async () => {
          const btn = el.querySelector('[data-check]');
          btn.textContent = '…';
          const result = await window.api.bleLoginCheck(p.deviceId);
          if (result.success) {
            btn.textContent = '✅ OK';
            showNotif(`✅ ${p.deviceName} in Reichweite — Login erfolgreich`);
          } else {
            btn.textContent = '❌';
            showNotif(`❌ ${p.deviceName} nicht erreichbar`);
          }
          setTimeout(() => btn.textContent = '🔍 Check', 3000);
        });
        el.querySelector('[data-unpair]').addEventListener('click', async () => {
          await window.api.bleUnpairLogin(p.deviceId);
          showNotif(`🔓 ${p.deviceName} entfernt`);
          loadBleDevices();
          loadBleLoginPanel();
        });
        pairedList.appendChild(el);
      });
    }
  }

  // Available (not yet paired)
  const availList = $('blp-available-list');
  if (availList) {
    availList.innerHTML = '';
    const unpaired = allDevices.filter(d => !pairs.some(p => p.deviceId === d.id));
    if (!unpaired.length) {
      availList.innerHTML = `<div class="empty-hint">Alle verfügbaren Geräte sind bereits gepaired.</div>`;
    } else {
      unpaired.forEach(d => {
        const el = document.createElement('div');
        el.className = 'blp-device';
        el.innerHTML = `
          <span class="blp-device-icon">${d.icon || '🔵'}</span>
          <div class="blp-device-info">
            <div class="blp-device-name">${esc(d.name)}</div>
            <div class="blp-device-sub">${d.isBle ? 'BLE' : 'BT Classic'}</div>
          </div>
          <button class="blp-action pair" data-pair="${d.id}">+ Als Login</button>`;

        el.querySelector('[data-pair]').addEventListener('click', async () => {
          await pairDeviceForLogin(d);
        });
        availList.appendChild(el);
      });
    }
  }
}

// BLE-Buttons
$('btn-ble-scan')?.addEventListener('click', async () => {
  const btn = $('btn-ble-scan');
  btn?.classList.add('spinning');
  await loadBleDevices();
  btn?.classList.remove('spinning');
});

$('btn-ble-login')?.addEventListener('click', () => openBleLoginPanel());

$('blp-close')?.addEventListener('click', () => {
  $('ble-login-panel').style.display = 'none';
});

$('ble-power-btn')?.addEventListener('click', async () => {
  const btn = $('ble-power-btn');
  const on  = btn?.classList.contains('on');
  await window.api.bleSetPower(!on);
  setTimeout(loadBleAdapter, 1000);
});

// Kleine Toast-Notification
function showNotif(msg) {
  let n = $('notif-toast');
  if (!n) {
    n = document.createElement('div');
    n.id = 'notif-toast';
    n.style.cssText = `
      position:fixed; bottom:70px; right:70px; z-index:2000;
      background:var(--bg-p); border:1px solid var(--bd2);
      border-radius:9px; padding:10px 16px;
      font-size:12px; color:var(--txt);
      box-shadow:0 6px 24px rgba(0,0,0,.5);
      animation:slideUp .18s ease;
      max-width:260px; pointer-events:none;
    `;
    document.body.appendChild(n);
  }
  n.textContent = msg;
  n.style.display = 'block';
  clearTimeout(n._t);
  n._t = setTimeout(() => { if (n) n.style.display = 'none'; }, 3000);
}

function guessDeviceIcon(ip, mac) {
  const last = parseInt(ip.split('.').pop());
  if (last === 1 || last === 254) return '🌐'; // Router
  const macU = mac.toUpperCase();
  // Bekannte OUI-Präfixe (grob)
  if (macU.startsWith('B8:27') || macU.startsWith('DC:A6') || macU.startsWith('E4:5F')) return '🍓'; // Raspberry Pi
  if (macU.startsWith('00:50:56') || macU.startsWith('00:0C:29')) return '🖥'; // VMware
  if (macU.startsWith('AC:BC') || macU.startsWith('F8:FF')) return '📱'; // Mobile
  return '💻'; // Default: Laptop/PC
}

// Scan-Button + Add-Conn-Button (direkt, da Script am Ende von body)
$('btn-scan-network')?.addEventListener('click', () => {
  const btn = $('btn-scan-network');
  if (btn) { btn.style.transition = 'transform .6s'; btn.style.transform = 'rotate(360deg)'; }
  setTimeout(() => { if (btn) btn.style.transform = ''; }, 700);
  loadLocalNetwork();
});
$('add-conn-left-btn')?.addEventListener('click', () => openConnectModal('any'));

// ── API KEY TOOL ──────────────────────────────────────────────

const API_KEY_SERVICES = [
  // ── KI & Agenten ──────────────────────────────────────────
  { section: '🤖 KI-Agenten & APIs' },
  {
    name: 'Anthropic (Claude)',
    icon: '⚗', color: '#cc785c',
    desc: 'Claude Opus, Sonnet, Haiku — direkt zur Key-Seite',
    url:  'https://console.anthropic.com/settings/keys',
    scope: 'API Keys verwalten, Vollzugriff'
  },
  {
    name: 'OpenAI (ChatGPT)',
    icon: '🤖', color: '#10a37f',
    desc: 'GPT-4o, o1 — API Keys erstellen',
    url:  'https://platform.openai.com/api-keys',
    scope: 'Neuen Key erstellen → Berechtigungen: All'
  },
  {
    name: 'Google AI (Gemini)',
    icon: '✦', color: '#4285f4',
    desc: 'Gemini Pro / Flash API Key',
    url:  'https://aistudio.google.com/app/apikey',
    scope: 'API Key erstellen'
  },
  {
    name: 'Perplexity AI',
    icon: '◎', color: '#20808d',
    desc: 'pplx-api Key für Suche + Chat',
    url:  'https://www.perplexity.ai/settings/api',
    scope: 'Generate → Full Access'
  },
  {
    name: 'Mistral AI',
    icon: 'M', color: '#ff7000',
    desc: 'Mistral Large / Small API',
    url:  'https://console.mistral.ai/api-keys/',
    scope: 'Create new key'
  },
  {
    name: 'Groq (schnelle Inferenz)',
    icon: '⚡', color: '#f55036',
    desc: 'Llama 3, Mixtral blitzschnell',
    url:  'https://console.groq.com/keys',
    scope: 'Create API Key'
  },
  {
    name: 'Cohere',
    icon: 'C', color: '#39594d',
    desc: 'Command R+ API',
    url:  'https://dashboard.cohere.com/api-keys',
    scope: 'Default: read+write'
  },

  // ── Cloud-Speicher ─────────────────────────────────────────
  { section: '☁ Cloud-Speicher' },
  {
    name: 'Google Drive (OAuth)',
    icon: '📁', color: '#0f9d58',
    desc: 'Google Cloud Console → Drive API aktivieren',
    url:  'https://console.cloud.google.com/apis/credentials',
    scope: 'OAuth 2.0 Client-ID → Typ: Desktop'
  },
  {
    name: 'Dropbox',
    icon: '📦', color: '#0061ff',
    desc: 'Dropbox App erstellen → Token generieren',
    url:  'https://www.dropbox.com/developers/apps',
    scope: 'Create App → Full Dropbox → Generate Token'
  },
  {
    name: 'MEGA',
    icon: '🔒', color: '#d9272e',
    desc: 'MEGAcmd oder MEGA-SDK verwenden',
    url:  'https://mega.io/developers',
    scope: 'API-Schlüssel via MEGAcmd'
  },
  {
    name: 'OneDrive (Microsoft)',
    icon: '☁', color: '#0078d4',
    desc: 'Azure App Registration → Microsoft Graph',
    url:  'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
    scope: 'New registration → Files.ReadWrite.All'
  },

  // ── Entwicklung ────────────────────────────────────────────
  { section: '⚡ Entwicklung & Tools' },
  {
    name: 'GitLab',
    icon: '🦊', color: '#fc6d26',
    desc: 'Personal Access Token für GitLab',
    url:  'https://gitlab.com/-/user_settings/personal_access_tokens',
    scope: 'Scopes: api, read_repo, write_repo'
  },
  {
    name: 'Bitbucket',
    icon: '🪣', color: '#0052cc',
    desc: 'App Password für Bitbucket API',
    url:  'https://bitbucket.org/account/settings/app-passwords/new',
    scope: 'Permissions: Repositories → Read+Write'
  },
  {
    name: 'Google Cloud',
    icon: '☁', color: '#4285f4',
    desc: 'Service Account Key oder API Key',
    url:  'https://console.cloud.google.com/apis/credentials',
    scope: 'Create Credentials → API Key oder Service Account'
  },
  {
    name: 'GitHub',
    icon: '⚡', color: '#58a6ff',
    desc: 'Personal Access Token (Classic) mit repo-Scope',
    url:  'https://github.com/settings/tokens/new',
    scope: 'Scopes: repo, delete_repo, workflow'
  },
  {
    name: 'GitHub Fine-Grained',
    icon: '⚡', color: '#3d8bff',
    desc: 'Granulare Rechte pro Repository',
    url:  'https://github.com/settings/personal-access-tokens/new',
    scope: 'Repository access → Contents: Read & Write'
  },
  {
    name: 'Notion',
    icon: 'N', color: '#ffffff',
    desc: 'Integration erstellen → Internal token',
    url:  'https://www.notion.so/my-integrations',
    scope: 'New integration → Full workspace access'
  },
  {
    name: 'Slack',
    icon: 'S', color: '#4a154b',
    desc: 'Bot Token für Workspace-Zugriff',
    url:  'https://api.slack.com/apps',
    scope: 'Create App → OAuth → xoxb Token'
  },
  {
    name: 'kChat (Infomaniak)',
    icon: '💬', color: '#1a73e8',
    desc: 'Infomaniak kChat API Token',
    url:  'https://manager.infomaniak.com/v3/profile/api-token',
    scope: 'Token erstellen → kChat-Zugriff'
  },
  {
    name: 'Infomaniak Mail',
    icon: '📮', color: '#1a73e8',
    desc: 'Infomaniak Mail API / IMAP-Zugang',
    url:  'https://manager.infomaniak.com/v3/profile/api-token',
    scope: 'API Token → Mail-Dienste'
  },

  // ── Kommunikation ──────────────────────────────────────────
  { section: '💬 Kommunikation' },
  {
    name: 'Telegram Bot',
    icon: 'T', color: '#0088cc',
    desc: 'BotFather → /newbot → Token erhalten',
    url:  'https://t.me/BotFather',
    scope: '/newbot → Token kopieren'
  },
  {
    name: 'Discord',
    icon: 'D', color: '#5865f2',
    desc: 'Bot-Token im Developer Portal',
    url:  'https://discord.com/developers/applications',
    scope: 'New Application → Bot → Reset Token'
  },
  {
    name: 'Twilio (SMS/Voice)',
    icon: '📱', color: '#f22f46',
    desc: 'Account SID + Auth Token',
    url:  'https://console.twilio.com/',
    scope: 'Dashboard → Account Info'
  },

  // ── Sonstige ───────────────────────────────────────────────
  { section: '🔧 Sonstige Dienste' },
  {
    name: 'Hugging Face',
    icon: '🤗', color: '#ff9d00',
    desc: 'Access Token für Models & Inference API',
    url:  'https://huggingface.co/settings/tokens',
    scope: 'New token → Type: Write (für eigene Repos)'
  },
  {
    name: 'Replicate',
    icon: '🔄', color: '#6b7280',
    desc: 'API Token für Open-Source-Modelle',
    url:  'https://replicate.com/account/api-tokens',
    scope: 'Create token'
  },
  {
    name: 'ElevenLabs (TTS)',
    icon: '🎙', color: '#9b5de5',
    desc: 'Text-to-Speech API Key',
    url:  'https://elevenlabs.io/app/settings/api-keys',
    scope: 'Create API Key → Creator oder höher'
  },
  {
    name: 'Serper (Google Suche)',
    icon: '🔍', color: '#ea4335',
    desc: 'Google Search API für Agenten',
    url:  'https://serper.dev/api-key',
    scope: 'API Key kopieren'
  },
];

function initApiKeyTool() {
  const fab   = $('apikey-fab');
  const panel = $('apikey-panel');
  const search= $('apikey-search');

  fab.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) {
      renderApiKeyList('');
      setTimeout(() => search.focus(), 80);
    }
  });

  $('apikey-panel-close').addEventListener('click', e => {
    e.stopPropagation();
    panel.style.display = 'none';
  });

  search.addEventListener('input', () => renderApiKeyList(search.value.trim().toLowerCase()));

  // Close when clicking outside
  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && e.target !== fab)
      panel.style.display = 'none';
  });

  renderApiKeyList('');
}

function renderApiKeyList(query) {
  const list = $('apikey-list');
  list.innerHTML = '';

  let currentSection = null;

  for (const entry of API_KEY_SERVICES) {
    if (entry.section) {
      currentSection = entry.section;
      continue;
    }

    // Filter by search query
    if (query && !entry.name.toLowerCase().includes(query) && !entry.desc.toLowerCase().includes(query))
      continue;

    // Section header (only if first matching item in section)
    if (currentSection) {
      const hdr = document.createElement('div');
      hdr.className = 'akp-section-title';
      hdr.textContent = currentSection;
      list.appendChild(hdr);
      currentSection = null; // only show once per section
    }

    const item = document.createElement('div');
    item.className = 'akp-item';
    item.title = entry.scope;
    item.innerHTML = `
      <div class="akp-icon" style="background:${entry.color}20;color:${entry.color}">${entry.icon}</div>
      <div class="akp-info">
        <div class="akp-name">${esc(entry.name)}</div>
        <div class="akp-desc">${esc(entry.desc)}</div>
      </div>
      <button class="akp-go">↗ Öffnen</button>`;

    item.querySelector('.akp-go').addEventListener('click', e => {
      e.stopPropagation();
      window.api.openExternal(entry.url);
    });
    item.addEventListener('click', () => window.api.openExternal(entry.url));

    list.appendChild(item);
  }

  if (!list.children.length) {
    list.innerHTML = `<div class="empty-hint">Kein Dienst gefunden für "${esc(query)}"</div>`;
  }
}

// Init after DOM is ready
initApiKeyTool();

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }
function autoResize(e) { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }
function agentLabel(a) { return {architect:'Architect',researcher:'Researcher',coder:'Coder',writer:'Writer',analyst:'Analyst',memory:'Memory'}[a]||a; }
function agentEmoji(a) { return {architect:'🏗',researcher:'🔍',coder:'💻',writer:'✍',analyst:'📊',memory:'🧠'}[a]||'⚡'; }
function catLabel(c)   { return {cloud:'☁ Cloud',comms:'💬 Komm',dev:'⚡ Dev',tool:'🔧 Tools',ai:'🤖 KI',social:'🌐 Social',custom:'⚙ Custom'}[c]||c; }
function modelShort(m) { return {'claude-opus-4-8':'Opus 4.8','claude-sonnet-4-6':'Sonnet 4.6','claude-haiku-4-5-20251001':'Haiku 4.5'}[m]||m; }
function relDate(ts)   { if (!ts) return ''; const d=Math.floor((Date.now()-ts)/86400000); return d===0?'heute':d===1?'gestern':`vor ${d}d`; }
