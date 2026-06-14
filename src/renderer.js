// ── AgenticFlow v1.0 — Main Renderer ─────────────────────
// Modules laden in index.html als Script-Tags (kein require)
// Reihenfolge: utils → accounts → sidebar → center → memory → this

// ── Global State ──────────────────────────────────────────
const S = {
  projects:        [],
  activeProjectId: null,
  chatMessages:    [],
  perfectMemory:   [],
  apiKeys:         {},
};

// ── Extra CSS inject ──────────────────────────────────────
(function() {
  const s = document.createElement('style');
  s.textContent = `
    .project-card {
      background: var(--bg-card); border: 1px solid var(--bd);
      border-radius: 10px; padding: 16px; cursor: pointer;
      transition: all .15s; position: relative;
      display: flex; flex-direction: column; gap: 8px;
    }
    .project-card:hover {
      border-color: var(--acc); transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(108,99,255,.15);
    }
    .pc-icon { font-size: 28px; }
    .pc-name { font-size: 14px; font-weight: 600; }
    .pc-meta { font-size: 10px; color: var(--txt-d); }
    .pc-desc { font-size: 11px; color: var(--txt-m); }
    .pc-del {
      position: absolute; top: 8px; right: 8px;
      width: 20px; height: 20px; background: transparent; border: none;
      color: var(--txt-d); cursor: pointer; border-radius: 4px;
      opacity: 0; font-size: 10px; display: flex; align-items: center; justify-content: center;
    }
    .project-card:hover .pc-del { opacity: 1; }
    .pc-del:hover { background: var(--danger); color: #fff; }

    .typing-dots { animation: tpulse 1.2s ease-in-out infinite; }
    @keyframes tpulse { 0%,100%{opacity:1}50%{opacity:.3} }

    .tool-btn.active { background: var(--acc) !important; color: #fff !important; }

    #left-panel.collapsed .app-item { position: relative; }
    #left-panel.collapsed .app-item::after {
      content: attr(title); pointer-events: none;
      position: absolute; left: 58px; top: 50%; transform: translateY(-50%);
      background: var(--bg-p); border: 1px solid var(--bd2);
      border-radius: 6px; padding: 4px 8px;
      font-size: 11px; color: var(--txt); white-space: nowrap; z-index: 100;
      opacity: 0; transition: opacity .1s;
    }
    #left-panel.collapsed .app-item:hover::after { opacity: 1; }

    .network-device-item {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 14px; font-size: 11px; color: var(--txt-m);
    }

    .settings-section { padding: 16px; border-bottom: 1px solid var(--bd); }
    .settings-label   { font-size: 11px; color: var(--txt-d); margin-bottom: 8px; }
    .settings-input   {
      width: 100%; height: 32px; padding: 0 10px;
      background: var(--bg-card); border: 1px solid var(--bd);
      border-radius: 6px; color: var(--txt); font-size: 12px; outline: none;
    }
    .settings-input:focus { border-color: var(--acc); }
    .settings-btn {
      height: 30px; padding: 0 14px; margin-top: 8px;
      background: var(--acc); border: none; border-radius: 6px;
      color: #fff; font-size: 11px; cursor: pointer; transition: background .12s;
    }
    .settings-btn:hover { background: var(--acc2); }

    .add-modal { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .add-modal input {
      height: 32px; padding: 0 10px;
      background: var(--bg-card); border: 1px solid var(--bd);
      border-radius: 6px; color: var(--txt); font-size: 12px; outline: none;
    }
    .add-modal input:focus { border-color: var(--acc); }
    .add-modal .app-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
    .add-modal .app-choice {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 10px 6px; background: var(--bg-card); border: 1px solid var(--bd);
      border-radius: 8px; cursor: pointer; transition: all .12s;
    }
    .add-modal .app-choice:hover { border-color: var(--acc); background: var(--bg-h); }
    .add-modal .app-choice.selected { border-color: var(--acc); background: var(--acc-dim); }
    .add-modal .app-choice-icon { font-size: 22px; }
    .add-modal .app-choice-name { font-size: 10px; color: var(--txt-m); text-align: center; }

    #view-home    { display: flex; flex-direction: column; }
    #view-project { display: none; flex-direction: column; }
    .home-welcome { display: none; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; }
    .hw-icon { font-size: 64px; }
    .home-welcome h2 { font-size: 20px; }
    .home-welcome p  { color: var(--txt-m); max-width: 300px; }

    #messages .message { display: flex; gap: 8px; max-width: 85%; margin-bottom: 2px; }
    #messages .message.user { align-self: flex-end; flex-direction: row-reverse; }
    #messages .message.assistant { align-self: flex-start; }
    .msg-avatar {
      width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 11px;
    }
    .message.user .msg-avatar      { background: var(--acc); color: #fff; }
    .message.assistant .msg-avatar { background: var(--bg-card); border: 1px solid var(--bd); }
    .msg-content {
      padding: 8px 12px; border-radius: 8px; font-size: 12px;
      line-height: 1.6; word-break: break-word; white-space: pre-wrap;
    }
    .message.user .msg-content      { background: var(--acc-dim); color: var(--acc2); }
    .message.assistant .msg-content { background: var(--bg-card); border: 1px solid var(--bd); }
    @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  `;
  document.head.appendChild(s);
})();

// ── App Ready ─────────────────────────────────────────────
window.api.onAppReady(data => {
  // Merge state
  Object.assign(S, {
    projects:        data.projects        || [],
    activeProjectId: data.activeProjectId || null,
    chatMessages:    data.chatHistory     || [],
    perfectMemory:   data.perfectMemory   || [],
    apiKeys:         data.apiKeys         || {},
  });

  // Seed accounts from stored connectors
  const allConns = [...(data.connectors || []), ...(data.rightApps || [])];
  accountMgr.seedFromConnectors(allConns);

  // Init managers
  authMgr.init(S);
  sidebar.init();
  taskbarMgr.init(S);
  centerMgr.init(S);
  memoryMgr.init(S);
  keyToolsMgr.init(S);

  // Restore active project
  if (S.activeProjectId) {
    const p = S.projects.find(x => x.id === S.activeProjectId);
    if (p) centerMgr.openProject(p);
  }

  // Load network info
  setTimeout(loadNetworkInfo, 1200);

  // Setup modals
  setupSettingsModal();
});

// ── Layout: BrowserView-Bounds an Main melden ─────────────
// Ohne diese Messung bleiben Konnektor-Views unsichtbar (centerBounds=null).
window.sendLayout = function() {
  requestAnimationFrame(() => {
    const cp = $('center-panel')?.getBoundingClientRect();
    if (!cp) return;
    const active = window.sidebar?.activeId || null;
    window.api.updateLayout?.({
      center: active ? {
        x: Math.round(cp.left), y: Math.round(cp.top),
        width: Math.round(cp.width), height: Math.round(cp.height),
      } : null,
      right: null, // rechtes Panel ist reines HTML (Memory-Chat)
    });
  });
};

window.api.onWindowResized?.(() => sendLayout());
window.addEventListener('resize', () => sendLayout());
window.addEventListener('app-open',  () => setTimeout(sendLayout, 50));
window.addEventListener('app-close', () => setTimeout(sendLayout, 50));
// Sidebar-Toggles ändern die Center-Breite → nach Animation neu messen
['left-toggle', 'right-toggle'].forEach(id =>
  document.getElementById(id)?.addEventListener('click', () => setTimeout(sendLayout, 240))
);

// ── Network Info ──────────────────────────────────────────
window.loadNetworkInfo = async function() {
  // WiFi
  try {
    const wifi = await window.api.getWifiInfo();
    const el = $('wifi-status');
    if (el) {
      el.innerHTML = `
        <span class="dot ${wifi.strength > 0 ? 'dot-online' : 'dot-offline'}"></span>
        <span>${esc(wifi.name)}</span>
        <span style="margin-left:auto;font-size:10px;color:var(--txt-d)">${wifi.strength || 0}%</span>
      `;
    }
  } catch {}

  // Network Devices
  try {
    const devs = await window.api.scanNetwork();
    const list = $('network-devices');
    if (list) {
      list.innerHTML = '';
      if (!devs.length) {
        list.innerHTML = '<div class="empty-hint">Keine Geräte gefunden</div>';
      } else {
        devs.slice(0,8).forEach(d => {
          const el = document.createElement('div');
          el.className = 'network-device-item';
          const icon = d.ip?.endsWith('.1') ? '🌐' : '💻';
          el.innerHTML = `<span>${icon}</span><span>${esc(d.ip)}</span><span style="margin-left:auto;font-size:9px;color:var(--txt-d)">${esc(d.mac?.slice(0,8) || '')}</span>`;
          list.appendChild(el);
        });
      }
    }
  } catch {}

  // BLE
  try {
    const bleDevs = await window.api.bleGetDevices();
    const list = $('ble-devices');
    if (list) {
      list.innerHTML = '';
      if (!bleDevs.length) {
        list.innerHTML = '<div class="empty-hint">Keine BLE-Geräte</div>';
      } else {
        bleDevs.forEach(d => {
          const paired = localStorage.getItem(`af_ble_${d.id}`) === 'true';
          const el = document.createElement('div');
          el.className = 'network-device-item';
          el.innerHTML = `
            <span>${d.icon || '🔵'}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.name)}</span>
            <button style="flex-shrink:0;background:${paired ? 'var(--success)' : 'var(--bg-card)'};border:1px solid var(--bd);border-radius:4px;padding:1px 6px;font-size:9px;color:${paired ? '#fff' : 'var(--txt-d)'};cursor:pointer" data-id="${esc(d.id)}" data-name="${esc(d.name)}" data-type="${esc(d.type || 'device')}">
              ${paired ? '🔑 Login' : '+ Pairen'}
            </button>
          `;
          el.querySelector('button').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            await window.api.blePairForLogin({ deviceId: btn.dataset.id, deviceName: btn.dataset.name, deviceType: btn.dataset.type });
            localStorage.setItem(`af_ble_${btn.dataset.id}`, 'true');
            loadNetworkInfo();
          });
          list.appendChild(el);
        });
      }
    }
  } catch {}
};

// ── BLE Code-Kopplung (6-stelliger Pairing-Code) ──────────
(function setupBlePairing() {
  const modal = $('ble-modal');
  $('ble-modal-close')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
  modal?.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  $('btn-ble-pair')?.addEventListener('click', async () => {
    const body = $('ble-modal-body');
    if (!modal || !body) return;
    modal.style.display = 'flex';
    body.innerHTML = '<div class="empty-hint">Suche BLE-Geräte…</div>';

    let devices = [];
    try { devices = await window.api.bleGetDevices() || []; } catch {}

    if (!devices.length) {
      body.innerHTML = '<div class="empty-hint">Keine BLE-Geräte gefunden. Bluetooth aktiv?</div>';
      return;
    }

    body.innerHTML = `
      <div style="font-size:11px;color:var(--txt-d);margin-bottom:8px">Gerät wählen, Code vergleichen, bestätigen:</div>
      <div id="ble-pair-list"></div>
      <div id="ble-pair-code" style="display:none;text-align:center;padding:14px">
        <div style="font-size:11px;color:var(--txt-d)">Pairing-Code — muss auf beiden Geräten gleich sein:</div>
        <div id="ble-code-digits" style="font-size:30px;font-weight:800;letter-spacing:8px;margin:10px 0;color:var(--acc2)"></div>
        <button class="settings-btn" id="ble-code-confirm">✓ Code stimmt — koppeln</button>
        <button class="settings-btn" id="ble-code-cancel" style="background:var(--bg-card);margin-left:6px">Abbrechen</button>
      </div>
    `;

    const list = $('ble-pair-list');
    devices.forEach(d => {
      const el = document.createElement('div');
      el.className = 'network-device-item';
      el.style.cursor = 'pointer';
      el.innerHTML = `<span>${d.icon || '🔵'}</span><span>${esc(d.name)}</span><span style="margin-left:auto;font-size:9px;color:var(--txt-d)">koppeln →</span>`;
      el.addEventListener('click', () => {
        // 6-stelligen Code erzeugen und anzeigen
        const code = String(Math.floor(100000 + Math.random() * 900000));
        $('ble-code-digits').textContent = code;
        $('ble-pair-code').style.display = 'block';
        list.style.display = 'none';

        $('ble-code-confirm').onclick = async () => {
          await window.api.blePairForLogin?.({
            deviceId: d.id, deviceName: d.name, deviceType: d.type || 'device', pairCode: code,
          });
          localStorage.setItem(`af_ble_${d.id}`, 'true');
          body.innerHTML = `<div style="text-align:center;padding:18px">✅ <b>${esc(d.name)}</b> gekoppelt!<br><span style="font-size:11px;color:var(--txt-d)">Login per BLE ist jetzt aktiv.</span></div>`;
          window.loadNetworkInfo?.();
        };
        $('ble-code-cancel').onclick = () => {
          $('ble-pair-code').style.display = 'none';
          list.style.display = 'block';
        };
      });
      list.appendChild(el);
    });
  });
})();

// ── Settings Modal ────────────────────────────────────────
function setupSettingsModal() {
  const modal = $('settings-modal');
  $('btn-settings')?.addEventListener('click', openSettings);
  $('settings-modal-close')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });
  modal?.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

function openSettings() {
  const modal = $('settings-modal');
  const body  = $('settings-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="settings-section">
      <div class="settings-label">Claude API Key</div>
      <input class="settings-input" id="inp-claude-key" type="password"
        placeholder="sk-ant-api03-…"
        value="${S.apiKeys.claude ? '••••••••' + S.apiKeys.claude.slice(-4) : ''}">
      <br><button class="settings-btn" id="btn-save-claude-key">Speichern</button>
    </div>
  `;

  $('btn-save-claude-key')?.addEventListener('click', () => {
    const val = $('inp-claude-key')?.value.trim();
    if (val && !val.startsWith('•')) {
      S.apiKeys.claude = val;
      window.api.saveApiKey?.('claude', val);
    }
    modal.style.display = 'none';
  });

  modal.style.display = 'flex';
}

// ── Add Account Modal (global, genutzt von sidebar.js) ────
window.openAddModal = function(cat) {
  const modal = $('settings-modal');
  const body  = $('settings-modal-body');
  const hdr   = modal?.querySelector('.modal-header span');
  if (!modal || !body) return;

  if (hdr) hdr.textContent = '➕ Account hinzufügen';

  const tmpls = Object.entries(window.APP_TEMPLATES)
    .filter(([, t]) => t.cat === cat)
    .map(([id, t]) => ({ id, ...t }));

  let selId = tmpls[0]?.id || null;

  body.innerHTML = `
    <div class="add-modal">
      <div class="app-grid">
        ${tmpls.map(t => `
          <div class="app-choice${t.id === selId ? ' selected' : ''}" data-id="${t.id}">
            <span class="app-choice-icon">${t.icon}</span>
            <span class="app-choice-name">${t.name}</span>
          </div>
        `).join('')}
      </div>
      <input type="text" id="add-label" placeholder="Account-Label (z.B. Privat, Arbeit)" autocomplete="off">
      <div id="add-suggestions"></div>
      <input type="text" id="add-url"   placeholder="Eigene URL (leer = Standard)">
      <button class="settings-btn" id="add-confirm">Hinzufügen</button>
    </div>
  `;

  // Vorschläge (gespeicherte/versteckte Accounts) rendern
  function renderSuggestions() {
    const box = $('add-suggestions');
    if (!box) return;
    const query = ($('add-label')?.value || '').toLowerCase();
    // Bekannte Accounts dieses Templates (auch versteckte)
    const known = accountMgr.accounts.filter(a =>
      a.templateId === selId &&
      (!query || (a.label || '').toLowerCase().includes(query))
    );
    if (!known.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div style="font-size:10px;color:var(--txt-d);margin:2px 0 4px">Bekannte Accounts (klicken zum Wiederverbinden):</div>` +
      known.map(a => {
        const cred = window.authMgr?.getCred(a.instanceId);
        const badge = cred ? (cred.method === 'oauth' ? '🔓' : '🔑') : '';
        return `<div class="kt-item" data-inst="${a.instanceId}" style="padding:6px 8px">
          <span class="app-choice-icon" style="font-size:16px">${a.icon}</span>
          <div class="kt-info"><div class="kt-name">${esc(a.label || '(Standard)')} ${badge}</div>
          <div class="kt-desc">${a.hidden ? 'ausgeblendet' : 'aktiv'}</div></div>
          <button class="kt-go">↻ Verbinden</button>
        </div>`;
      }).join('');

    box.querySelectorAll('[data-inst]').forEach(el => {
      el.addEventListener('click', () => {
        const inst = el.dataset.inst;
        const acc = accountMgr.getById(inst);
        if (acc) {
          accountMgr.updateInstance(inst, { hidden: false });
          sidebar.render();
          modal.style.display = 'none';
          if (hdr) hdr.textContent = '⚙ Einstellungen';
        }
      });
    });
  }

  body.querySelectorAll('.app-choice').forEach(el => {
    el.addEventListener('click', () => {
      selId = el.dataset.id;
      body.querySelectorAll('.app-choice').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      renderSuggestions();
    });
  });

  $('add-label')?.addEventListener('input', renderSuggestions);
  renderSuggestions();

  $('add-confirm')?.addEventListener('click', () => {
    if (!selId) return;
    const label     = $('add-label')?.value.trim() || '';
    const customUrl = $('add-url')?.value.trim()   || '';
    const acc = accountMgr.addInstance(selId, label);
    if (acc && customUrl) { acc.url = customUrl; accountMgr._save('accounts', accountMgr.accounts); }
    sidebar.render();
    modal.style.display = 'none';
    if (hdr) hdr.textContent = '⚙ Einstellungen';
  });

  modal.style.display = 'flex';
};
