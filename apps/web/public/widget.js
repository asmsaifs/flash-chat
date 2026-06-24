(function () {
  'use strict';

  var scriptEl = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  var channelId = scriptEl.getAttribute('data-channel');
  var apiUrl = (scriptEl.getAttribute('data-api') || 'http://localhost:4000').replace(/\/$/, '');

  if (!channelId) return;

  // ── State ──────────────────────────────────────────────────────────────────
  var state = {
    open: false,
    initialized: false,
    conversationId: null,
    visitorToken: null,
    externalId: null,
    messages: [],
    socket: null,
  };

  var STORAGE_KEY = 'fc_' + channelId;
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.visitorToken) {
      state.conversationId = saved.conversationId;
      state.visitorToken = saved.visitorToken;
      state.externalId = saved.externalId;
    }
  } catch (_) {}

  // ── CSS ────────────────────────────────────────────────────────────────────
  var css = [
    '#fc-bubble{position:fixed;bottom:20px;right:20px;z-index:2147483646;width:56px;height:56px;border-radius:50%;',
    'background:#6366f1;box-shadow:0 4px 14px rgba(99,102,241,.45);cursor:pointer;border:none;',
    'display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}',
    '#fc-bubble:hover{transform:scale(1.07);box-shadow:0 6px 18px rgba(99,102,241,.55)}',
    '#fc-bubble svg{width:26px;height:26px;fill:#fff}',
    '#fc-panel{position:fixed;bottom:88px;right:20px;z-index:2147483645;width:360px;height:520px;',
    'border-radius:16px;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.18);',
    'display:flex;flex-direction:column;overflow:hidden;',
    'transform:scale(.92) translateY(12px);opacity:0;transition:transform .22s ease,opacity .22s ease;pointer-events:none}',
    '#fc-panel.fc-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all}',
    '#fc-head{padding:16px;background:#6366f1;color:#fff;display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '#fc-av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);',
    'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0}',
    '#fc-head-info{flex:1;min-width:0}',
    '#fc-head-title{font-weight:600;font-size:15px;line-height:1.2}',
    '#fc-head-sub{font-size:12px;opacity:.75;margin-top:2px}',
    '#fc-new{background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;',
    'color:rgba(255,255,255,.8);display:flex;align-items:center;justify-content:center;',
    'transition:background .15s;flex-shrink:0}',
    '#fc-new:hover{background:rgba(255,255,255,.15);color:#fff}',
    '#fc-new svg{width:16px;height:16px;fill:currentColor}',
    '#fc-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}',
    '.fc-m{max-width:82%;padding:8px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;word-break:break-word;font-family:inherit}',
    '.fc-in{background:#f1f5f9;color:#1e293b;align-self:flex-start;border-bottom-left-radius:4px}',
    '.fc-out{background:#6366f1;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '#fc-footer{padding:10px 12px;border-top:1px solid #e2e8f0;display:flex;gap:8px;flex-shrink:0}',
    '#fc-inp{flex:1;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:13.5px;',
    'outline:none;font-family:inherit;transition:border-color .15s}',
    '#fc-inp:focus{border-color:#6366f1}',
    '#fc-send{background:#6366f1;color:#fff;border:none;border-radius:10px;padding:8px 14px;',
    'cursor:pointer;font-size:13.5px;font-weight:600;transition:background .15s}',
    '#fc-send:hover{background:#4f46e5}',
    '#fc-pw{text-align:center;padding:5px 0 8px;font-size:11px;color:#94a3b8}',
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Bubble ─────────────────────────────────────────────────────────────────
  var bubble = document.createElement('button');
  bubble.id = 'fc-bubble';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 10H6v-2h12v2zm0-3H6V7h12v2z"/></svg>';
  document.body.appendChild(bubble);

  // ── Panel ──────────────────────────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.id = 'fc-panel';
  panel.innerHTML = [
    '<div id="fc-head">',
    '  <div id="fc-av">FC</div>',
    '  <div id="fc-head-info"><div id="fc-head-title">Support</div><div id="fc-head-sub">We reply in minutes</div></div>',
    '  <button id="fc-new" title="New conversation" aria-label="Start new conversation">',
    '    <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    '  </button>',
    '</div>',
    '<div id="fc-msgs"></div>',
    '<div id="fc-footer">',
    '  <input id="fc-inp" type="text" placeholder="Type a message…" autocomplete="off" />',
    '  <button id="fc-send">Send</button>',
    '</div>',
    '<div id="fc-pw">Powered by FlashChat</div>',
  ].join('');
  document.body.appendChild(panel);

  var msgsEl = document.getElementById('fc-msgs');
  var inpEl = document.getElementById('fc-inp');
  var sendEl = document.getElementById('fc-send');
  var newEl = document.getElementById('fc-new');

  // Load widget config to update branding
  fetch(apiUrl + '/widget/' + channelId + '/config')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      if (!res || !res.data) return;
      var t = document.getElementById('fc-head-title');
      var a = document.getElementById('fc-av');
      if (t) t.textContent = res.data.name || 'Support';
      if (a) a.textContent = (res.data.name || 'S')[0].toUpperCase();
    })
    .catch(function () {});

  // ── Rendering ──────────────────────────────────────────────────────────────
  function renderMessages() {
    msgsEl.innerHTML = '';
    state.messages.forEach(function (msg) {
      var el = document.createElement('div');
      // inbound = visitor sent it (shown on right), outbound = agent/bot (shown on left)
      el.className = 'fc-m ' + (msg.direction === 'inbound' ? 'fc-out' : 'fc-in');
      el.textContent = (msg.content && msg.content.text) || '';
      msgsEl.appendChild(el);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  // ── Socket.io real-time ────────────────────────────────────────────────────
  function connectSocket() {
    if (state.socket || !state.conversationId || !state.visitorToken) return;

    // socket.io client served by the API server
    var ioUrl = apiUrl + '/socket.io/socket.io.js';
    if (typeof io !== 'undefined') {
      _doConnect();
      return;
    }
    var s = document.createElement('script');
    s.src = ioUrl;
    s.onload = _doConnect;
    document.head.appendChild(s);
  }

  function _doConnect() {
    if (state.socket) return;
    /* global io */
    state.socket = io(apiUrl + '/widget', {
      auth: { visitorToken: state.visitorToken, conversationId: state.conversationId },
      transports: ['websocket'],
    });
    state.socket.on('message:receive', function (data) {
      var msg = { direction: 'outbound', content: data.content, sentAt: new Date().toISOString() };
      state.messages.push(msg);
      renderMessages();
    });
  }

  // ── Session init ───────────────────────────────────────────────────────────
  function initSession(cb) {
    if (state.conversationId) { cb(); return; }
    fetch(apiUrl + '/widget/' + channelId + '/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: state.externalId }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !res.data) return;
        state.conversationId = res.data.conversationId;
        state.visitorToken = res.data.visitorToken;
        state.externalId = res.data.externalId;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            conversationId: state.conversationId,
            visitorToken: state.visitorToken,
            externalId: state.externalId,
          }));
        } catch (_) {}
        cb();
      })
      .catch(function (e) { console.error('[FlashChat]', e); });
  }

  function loadHistory() {
    var url = apiUrl + '/widget/' + channelId + '/conversations/' + state.conversationId + '/messages';
    fetch(url, { headers: { Authorization: 'Bearer ' + state.visitorToken } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !res.data) return;
        state.messages = res.data;
        if (res.data.length) state.lastSentAt = res.data[res.data.length - 1].sentAt;
        renderMessages();
      })
      .catch(function () {});
  }

  // ── Send message ───────────────────────────────────────────────────────────
  function doSend(text) {
    fetch(
      apiUrl + '/widget/' + channelId + '/conversations/' + state.conversationId + '/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.visitorToken },
        body: JSON.stringify({ text: text }),
      }
    )
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !res.data) return;
        state.messages.push(res.data);
        state.lastSentAt = res.data.sentAt;
        renderMessages();
      })
      .catch(function () {});
  }

  function sendMessage() {
    var text = inpEl.value.trim();
    if (!text) return;
    inpEl.value = '';
    if (!state.conversationId) {
      initSession(function () { connectSocket(); loadHistory(); doSend(text); });
    } else {
      doSend(text);
    }
  }

  // ── New session ────────────────────────────────────────────────────────────
  function resetSession() {
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
    state.conversationId = null;
    state.visitorToken = null;
    state.externalId = null;
    state.messages = [];
    state.initialized = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    renderMessages();
    inpEl.focus();
    initSession(function () {
      loadHistory();
      connectSocket();
    });
  }

  newEl.addEventListener('click', resetSession);

  // ── Toggle ─────────────────────────────────────────────────────────────────
  bubble.addEventListener('click', function () {
    state.open = !state.open;
    if (state.open) {
      panel.classList.add('fc-open');
      if (!state.initialized) {
        state.initialized = true;
        if (state.conversationId) {
          loadHistory();
          connectSocket();
        } else {
          initSession(function () {
            loadHistory();
            connectSocket();
          });
        }
      }
      setTimeout(function () { inpEl.focus(); }, 250);
    } else {
      panel.classList.remove('fc-open');
    }
  });

  sendEl.addEventListener('click', sendMessage);
  inpEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
