/**
 * A tiny bearer-token HTTP control plane for the headless runner: the other
 * half of the remote kill switch, for when you have network access to the
 * box running the engine but the phone or terminal running it is not in
 * front of you. It also serves a plain-HTML dashboard so the engine can be
 * watched visually instead of read out of a scrolling terminal log.
 *
 *   GET  /                 the dashboard page (no token needed to load the
 *                          page itself — it asks for the token in the
 *                          browser and only sends it to this same server)
 *   GET  /status           a snapshot: status, account, positions, recent
 *                          activity and trades
 *   POST /flatten          close every open position now
 *   POST /stop?flatten=1   stop the engine, optionally flattening first
 *
 * Every data/action route requires `Authorization: Bearer <token>`, so an
 * unauthenticated request learns nothing about the account. It binds to
 * 127.0.0.1 by default; reaching it from elsewhere is left to you — an SSH
 * tunnel or your own reverse proxy with its own auth, not a public bind.
 */
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

function positionView(pos, symbolState) {
  const lastPrice = symbolState?.lastPrice ?? pos.entryPrice;
  const dir = pos.side === 'long' ? 1 : -1;
  const unrealizedPnl = (lastPrice - pos.entryPrice) * pos.qty * dir;
  const cost = pos.entryPrice * pos.qty;
  return {
    symbol: pos.symbol,
    side: pos.side,
    qty: pos.qty,
    entryPrice: pos.entryPrice,
    lastPrice,
    unrealizedPnl,
    unrealizedPnlPct: cost > 0 ? (unrealizedPnl / cost) * 100 : 0,
    stopPrice: pos.stopPrice,
    takeProfitPrice: pos.takeProfitPrice,
    openedAt: pos.openedAt,
  };
}

function statusPayload(engine, meta) {
  const snap = engine.snapshot();
  const positions = Object.values(snap.positions ?? {});
  const symbols = snap.symbols ?? {};
  return {
    ok: true,
    venue: meta.venue ?? null,
    mode: meta.mode ?? null,
    status: snap.status,
    statusDetail: snap.statusDetail,
    clock: snap.clock ?? null,
    account: snap.account ?? null,
    openPositions: positions.length,
    positions: positions.map((p) => positionView(p, symbols[p.symbol])),
    tradesToday: snap.tradesToday ?? 0,
    realizedPnlToday: snap.realizedPnlToday ?? 0,
    recentTrades: (snap.trades ?? [])
      .slice(-10)
      .reverse()
      .map((t) => ({
        symbol: t.symbol,
        side: t.side,
        qty: t.qty,
        pnl: t.pnl,
        pnlPct: t.pnlPct,
        exitReason: t.exitReason,
        closedAt: t.closedAt,
      })),
    activity: (snap.activity ?? []).slice(0, 30),
    streams: snap.streams ?? null,
    lastTickAt: snap.lastTickAt ?? null,
    // Equity used to still be the whole `/status` payload; kept at top level too
    // so nothing that reads it directly from here breaks.
    equity: snap.account?.equity ?? null,
  };
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TradeRunner — live monitor</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 16px; background: #0b0f14; color: #e6edf3;
    font: 15px/1.4 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #8b949e; font-size: 13px; margin-bottom: 16px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .card {
    background: #161b22; border: 1px solid #30363d; border-radius: 10px;
    padding: 12px 16px; flex: 1 1 140px;
  }
  .card .label { color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .card .value { font-size: 22px; font-weight: 600; margin-top: 4px; }
  .pill {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 13px; font-weight: 600; text-transform: uppercase;
  }
  .pill.running { background: #1a4d2e; color: #56d364; }
  .pill.starting { background: #3d3a14; color: #e3b341; }
  .pill.halted { background: #3d3a14; color: #e3b341; }
  .pill.error { background: #4d1a1a; color: #ff7b72; }
  .pill.stopped { background: #21262d; color: #8b949e; }
  .pill.offline { background: #21262d; color: #8b949e; }
  .pos { color: #56d364; }
  .neg { color: #ff7b72; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #21262d; }
  th { color: #8b949e; font-weight: 500; }
  section { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
  section h2 { font-size: 14px; margin: 0 0 10px; color: #8b949e; text-transform: uppercase; letter-spacing: .04em; }
  .activity-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid #21262d; font-size: 13px; }
  .activity-row .t { color: #8b949e; white-space: nowrap; }
  .activity-row .lvl { text-transform: uppercase; font-size: 11px; white-space: nowrap; }
  .activity-row .lvl.warn { color: #e3b341; }
  .activity-row .lvl.error { color: #ff7b72; }
  .activity-row .lvl.info { color: #8b949e; }
  .gate { max-width: 420px; margin: 60px auto; }
  .gate input {
    width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #30363d;
    background: #0d1117; color: #e6edf3; font-size: 14px; margin-bottom: 10px;
  }
  button {
    padding: 8px 14px; border-radius: 8px; border: 1px solid #30363d;
    background: #21262d; color: #e6edf3; font-size: 13px; cursor: pointer;
  }
  button:hover { background: #30363d; }
  button.danger { background: #4d1a1a; border-color: #6e2b2b; color: #ff7b72; }
  button.danger:hover { background: #5c1f1f; }
  .actions { display: flex; gap: 8px; margin-top: 10px; }
  .msg { font-size: 13px; color: #8b949e; margin-top: 8px; min-height: 16px; }
  .empty { color: #8b949e; font-size: 13px; padding: 8px 0; }
  a.reset { color: #8b949e; font-size: 12px; cursor: pointer; text-decoration: underline; }
</style>
</head>
<body>

<div id="gate" class="gate">
  <h1>TradeRunner monitor</h1>
  <p class="sub">Paste the control token you started the engine with (--control-token / CONTROL_TOKEN). It's only used to talk to this same computer and is saved in this browser only.</p>
  <input id="tokenInput" type="password" placeholder="control token" />
  <button id="connectBtn">Connect</button>
  <div id="gateMsg" class="msg"></div>
</div>

<div id="app" style="display:none">
  <h1>TradeRunner monitor <span id="statusPill" class="pill stopped">stopped</span></h1>
  <div class="sub" id="subline">connecting…</div>

  <div class="row">
    <div class="card"><div class="label">Equity</div><div class="value" id="equity">—</div></div>
    <div class="card"><div class="label">Cash</div><div class="value" id="cash">—</div></div>
    <div class="card"><div class="label">Realized P&amp;L today</div><div class="value" id="pnlToday">—</div></div>
    <div class="card"><div class="label">Open positions</div><div class="value" id="openCount">—</div></div>
  </div>

  <section>
    <h2>Positions</h2>
    <table id="posTable">
      <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Last</th><th>Unrealized</th><th>Stop</th><th>Target</th></tr></thead>
      <tbody></tbody>
    </table>
    <div id="posEmpty" class="empty" style="display:none">No open positions.</div>
  </section>

  <section>
    <h2>Recent activity</h2>
    <div id="activityList"></div>
    <div id="activityEmpty" class="empty" style="display:none">No activity yet.</div>
  </section>

  <section>
    <h2>Recent trades</h2>
    <table id="tradesTable">
      <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>P&amp;L</th><th>Reason</th><th>Closed</th></tr></thead>
      <tbody></tbody>
    </table>
    <div id="tradesEmpty" class="empty" style="display:none">No closed trades yet.</div>
  </section>

  <section>
    <h2>Controls</h2>
    <div class="actions">
      <button id="flattenBtn">Close all positions now</button>
      <button id="stopBtn" class="danger">Stop engine</button>
      <button id="stopFlattenBtn" class="danger">Stop &amp; close all positions</button>
    </div>
    <div id="actionMsg" class="msg"></div>
    <div style="margin-top:10px"><a class="reset" id="resetLink">forget saved token</a></div>
  </section>
</div>

<script>
(function () {
  const TOKEN_KEY = 'tr_control_token';
  const gate = document.getElementById('gate');
  const app = document.getElementById('app');
  const gateMsg = document.getElementById('gateMsg');
  const tokenInput = document.getElementById('tokenInput');
  let token = localStorage.getItem(TOKEN_KEY) || '';
  let pollTimer = null;

  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return '';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function signClass(n) {
    return n > 0 ? 'pos' : n < 0 ? 'neg' : '';
  }
  function timeOf(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleTimeString();
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      ...opts,
      headers: { ...(opts && opts.headers), Authorization: 'Bearer ' + token },
    });
    if (res.status === 401) {
      stopPolling();
      localStorage.removeItem(TOKEN_KEY);
      token = '';
      showGate('That token was rejected. Double-check it and reconnect.');
      throw new Error('unauthorized');
    }
    return res;
  }

  function showGate(msg) {
    app.style.display = 'none';
    gate.style.display = 'block';
    gateMsg.textContent = msg || '';
  }
  function showApp() {
    gate.style.display = 'none';
    app.style.display = 'block';
  }

  function render(s) {
    const pill = document.getElementById('statusPill');
    pill.textContent = s.status;
    pill.className = 'pill ' + s.status;
    document.getElementById('subline').textContent =
      (s.venue ? s.venue : 'Venue —') + ' · ' + (s.mode ? s.mode.toUpperCase() : '') +
      (s.statusDetail ? ' · ' + s.statusDetail : '');

    document.getElementById('equity').textContent = money(s.account ? s.account.equity : null);
    document.getElementById('cash').textContent = money(s.account ? s.account.cash : null);
    const pnlEl = document.getElementById('pnlToday');
    pnlEl.textContent = money(s.realizedPnlToday);
    pnlEl.className = 'value ' + signClass(s.realizedPnlToday);
    document.getElementById('openCount').textContent = String(s.openPositions);

    const posBody = document.querySelector('#posTable tbody');
    posBody.innerHTML = '';
    document.getElementById('posEmpty').style.display = s.positions.length ? 'none' : 'block';
    for (const p of s.positions) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + p.symbol + '</td>' +
        '<td>' + p.side + '</td>' +
        '<td>' + p.qty + '</td>' +
        '<td>' + money(p.entryPrice) + '</td>' +
        '<td>' + money(p.lastPrice) + '</td>' +
        '<td class="' + signClass(p.unrealizedPnl) + '">' + money(p.unrealizedPnl) + ' (' + pct(p.unrealizedPnlPct) + ')</td>' +
        '<td>' + money(p.stopPrice) + '</td>' +
        '<td>' + money(p.takeProfitPrice) + '</td>';
      posBody.appendChild(tr);
    }

    const actList = document.getElementById('activityList');
    actList.innerHTML = '';
    document.getElementById('activityEmpty').style.display = s.activity.length ? 'none' : 'block';
    for (const ev of s.activity) {
      const row = document.createElement('div');
      row.className = 'activity-row';
      row.innerHTML =
        '<span class="t">' + timeOf(ev.at) + '</span>' +
        '<span class="lvl ' + ev.level + '">' + ev.level + '</span>' +
        '<span>' + (ev.symbol ? '[' + ev.symbol + '] ' : '') + ev.message + '</span>';
      actList.appendChild(row);
    }

    const tradesBody = document.querySelector('#tradesTable tbody');
    tradesBody.innerHTML = '';
    document.getElementById('tradesEmpty').style.display = s.recentTrades.length ? 'none' : 'block';
    for (const t of s.recentTrades) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + t.symbol + '</td>' +
        '<td>' + t.side + '</td>' +
        '<td>' + t.qty + '</td>' +
        '<td class="' + signClass(t.pnl) + '">' + money(t.pnl) + (t.pnlPct !== null ? ' (' + pct(t.pnlPct * 100) + ')' : '') + '</td>' +
        '<td>' + (t.exitReason || '') + '</td>' +
        '<td>' + timeOf(t.closedAt) + '</td>';
      tradesBody.appendChild(tr);
    }
  }

  async function poll() {
    try {
      const res = await api('/status');
      const s = await res.json();
      render(s);
    } catch (e) {
      // 401 already handled inside api(); anything else means the server
      // is briefly unreachable — leave the last-rendered state up and retry.
    }
  }

  function startPolling() {
    showApp();
    poll();
    pollTimer = setInterval(poll, 4000);
  }
  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  document.getElementById('connectBtn').addEventListener('click', () => {
    const v = tokenInput.value.trim();
    if (!v) return;
    token = v;
    localStorage.setItem(TOKEN_KEY, token);
    startPolling();
  });
  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('connectBtn').click();
  });
  document.getElementById('resetLink').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    token = '';
    stopPolling();
    showGate('Token forgotten.');
  });

  async function confirmAndPost(path, label) {
    if (!window.confirm(label + ' — are you sure?')) return;
    const msgEl = document.getElementById('actionMsg');
    msgEl.textContent = 'Working…';
    try {
      const res = await api(path, { method: 'POST' });
      const body = await res.json();
      msgEl.textContent = body.ok ? 'Done.' : 'Failed: ' + (body.message || res.status);
      poll();
    } catch (e) {
      msgEl.textContent = 'Request failed.';
    }
  }
  document.getElementById('flattenBtn').addEventListener('click', () => confirmAndPost('/flatten', 'Close every open position right now'));
  document.getElementById('stopBtn').addEventListener('click', () => confirmAndPost('/stop', 'Stop the engine (positions stay open)'));
  document.getElementById('stopFlattenBtn').addEventListener('click', () => confirmAndPost('/stop?flatten=1', 'Stop the engine and close every open position'));

  if (token) {
    tokenInput.value = token;
    startPolling();
  } else {
    showGate('');
  }
})();
</script>
</body>
</html>
`;

export async function startControlServer({ engine, token, port, host = '127.0.0.1', venue = null, mode = null, log = console.log }) {
  if (!token) throw new Error('startControlServer requires a non-empty token');

  function authorised(req) {
    const given = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (given.length !== token.length) return false;
    return timingSafeEqual(Buffer.from(given), Buffer.from(token));
  }

  const server = createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (url.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(DASHBOARD_HTML);
      }

      if (!authorised(req)) return send(401, { ok: false, message: 'control token required' });

      if (url.pathname === '/status' && req.method === 'GET') {
        return send(200, statusPayload(engine, { venue, mode }));
      }

      if (url.pathname === '/flatten' && req.method === 'POST') {
        log('[control] flatten requested');
        await engine.flattenAll('manual');
        return send(200, { ok: true });
      }

      if (url.pathname === '/stop' && req.method === 'POST') {
        const flatten = url.searchParams.get('flatten') === 'true' || url.searchParams.get('flatten') === '1';
        log(`[control] stop requested (flatten=${flatten})`);
        await engine.stop('manual', flatten);
        return send(200, { ok: true });
      }

      return send(404, { ok: false, message: 'not found' });
    } catch (e) {
      log(`[control] error handling ${req.method} ${req.url}: ${e instanceof Error ? e.message : String(e)}`);
      return send(500, { ok: false, message: e instanceof Error ? e.message : String(e) });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
