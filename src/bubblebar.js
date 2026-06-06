/* AgenticBubble — Bar-Renderer (eine Gruppe pro Fenster) */

const $ = s => document.querySelector(s);

let state    = { bubbles: [], groups: [] };
let group    = null;            // diese Gruppe
let active   = null;            // aktive Bubble (Chat offen)
let history  = {};              // bubbleId -> [{role, content}]
let editing  = null;            // Bubble im Editor (null = neu)
let busy     = false;

async function load() {
  state = await window.bubbleApi.getState();
  group = state.groups.find(g => g.id === window.bubbleApi.groupId) || state.groups[0];
  document.body.classList.toggle('dock-right', group?.edge === 'right');
  renderBubbles();
  if (active && !groupBubbles().find(b => b.id === active.id)) closePanel();
}

function groupBubbles() {
  if (!group) return [];
  return group.bubbleIds.map(id => state.bubbles.find(b => b.id === id)).filter(Boolean);
}

function renderBubbles() {
  const wrap = $('#bubbles');
  wrap.innerHTML = '';
  for (const b of groupBubbles()) {
    const el = document.createElement('button');
    el.className = 'bubble' + (active?.id === b.id ? ' active' : '');
    el.innerHTML = `${b.icon || '🫧'}<span class="tip">${esc(b.name)} · ${esc(b.engine)}</span>`;
    el.onclick = () => active?.id === b.id ? closePanel() : openPanel(b);
    el.oncontextmenu = e => { e.preventDefault(); openEditor(b); };
    wrap.appendChild(el);
  }
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ── Chat-Panel ── */

function openPanel(b) {
  active = b;
  $('#panel').classList.add('open');
  $('#panel-title').textContent = `${b.icon || '🫧'} ${b.name}`;
  window.bubbleApi.expand(true);
  renderBubbles();
  renderMsgs();
  renderQuick();
  $('#inp').focus();
}

function closePanel() {
  active = null;
  $('#panel').classList.remove('open');
  window.bubbleApi.expand(false);
  renderBubbles();
}

function renderMsgs() {
  const wrap = $('#msgs');
  wrap.innerHTML = '';
  for (const m of (history[active.id] || [])) {
    const el = document.createElement('div');
    el.className = `msg ${m.role === 'user' ? 'user' : m.error ? 'err' : 'bot'}`;
    el.textContent = m.content;
    if (m.citations?.length) {
      const src = document.createElement('span');
      src.className = 'src';
      src.textContent = '📎 ' + m.citations.slice(0, 5).join('  ·  ');
      el.appendChild(src);
    }
    wrap.appendChild(el);
  }
  wrap.scrollTop = wrap.scrollHeight;
}

function renderQuick() {
  const wrap = $('#quick');
  wrap.innerHTML = '';
  for (const qa of (active.quickActions || [])) {
    const btn = document.createElement('button');
    btn.textContent = qa.label;
    btn.onclick = () => { $('#inp').value = qa.prompt + ' '; $('#inp').focus(); };
    wrap.appendChild(btn);
  }
}

async function send() {
  const inp = $('#inp');
  const text = inp.value.trim();
  if (!text || busy || !active) return;
  inp.value = '';
  busy = true; $('#send').disabled = true;

  const h = history[active.id] = history[active.id] || [];
  h.push({ role: 'user', content: text });
  renderMsgs();

  const messages = h.filter(m => !m.error).map(m => ({ role: m.role, content: m.content }));
  const res = await window.bubbleApi.run(active.id, messages);

  if (res.ok) h.push({ role: 'assistant', content: res.text || '(leere Antwort)', citations: res.citations });
  else        h.push({ role: 'assistant', content: '⚠ ' + res.error, error: true });

  busy = false; $('#send').disabled = false;
  renderMsgs();
}

/* ── Editor ── */

function openEditor(b) {
  editing = b || null;
  $('#ed-title').textContent  = b ? 'Bubble bearbeiten' : 'Neue Bubble';
  $('#ed-icon').value   = b?.icon || '🫧';
  $('#ed-name').value   = b?.name || '';
  $('#ed-engine').value = b?.engine || 'claude';
  $('#ed-model').value  = b?.model || '';
  $('#ed-prompt').value = b?.systemPrompt || '';
  $('#ed-temp').value   = b?.temperature ?? 0.7;
  $('#ed-qa').value     = (b?.quickActions || []).map(q => `${q.label} | ${q.prompt}`).join('\n');
  $('#ed-delete').style.display = b ? '' : 'none';
  $('#editor').classList.add('open');
}

async function saveEditor() {
  const qa = $('#ed-qa').value.split('\n').map(l => l.split('|')).filter(p => p.length >= 2)
    .map(p => ({ label: p[0].trim(), prompt: p.slice(1).join('|').trim() }));
  const bubble = {
    id:           editing?.id,
    icon:         $('#ed-icon').value.trim() || '🫧',
    name:         $('#ed-name').value.trim() || 'Bubble',
    engine:       $('#ed-engine').value,
    model:        $('#ed-model').value.trim(),
    systemPrompt: $('#ed-prompt').value,
    temperature:  Math.min(1, Math.max(0, parseFloat($('#ed-temp').value) || 0.7)),
    quickActions: qa,
  };
  await window.bubbleApi.saveBubble(bubble);
  $('#editor').classList.remove('open');
  await load();
}

/* ── Wiring ── */

$('#send').onclick  = send;
$('#inp').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
$('#close').onclick = closePanel;
$('#clear').onclick = () => { if (active) { history[active.id] = []; renderMsgs(); } };
$('#edit').onclick  = () => active && openEditor(active);
$('#add').onclick   = () => openEditor(null);
$('#dock').onclick  = async () => {
  if (!group) return;
  const edge = group.edge === 'right' ? 'left' : 'right';
  await window.bubbleApi.saveGroup({ id: group.id, edge, x: null });
  await load();
  window.bubbleApi.expand(!!active);
};

$('#ed-save').onclick   = saveEditor;
$('#ed-cancel').onclick = () => $('#editor').classList.remove('open');
$('#ed-delete').onclick = async () => {
  if (editing) await window.bubbleApi.deleteBubble(editing.id);
  $('#editor').classList.remove('open');
  if (active?.id === editing?.id) closePanel();
  await load();
};

window.bubbleApi.onChanged(load);
load();
