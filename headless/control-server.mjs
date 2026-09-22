/**
 * A tiny bearer-token HTTP control plane for the headless runner: the other
 * half of the remote kill switch, for when you have network access to the
 * box running the engine but the phone or terminal running it is not in
 * front of you.
 *
 *   POST /flatten          close every open position now
 *   POST /stop?flatten=1   stop the engine, optionally flattening first
 *   GET  /status           a minimal snapshot: status, open count, equity
 *
 * Every route requires `Authorization: Bearer <token>`, including /status,
 * so an unauthenticated request learns nothing about the account. It binds
 * to 127.0.0.1 by default; reaching it from elsewhere is left to you — an
 * SSH tunnel or your own reverse proxy with its own auth, not a public bind.
 */
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

export async function startControlServer({ engine, token, port, host = '127.0.0.1', log = console.log }) {
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
      if (!authorised(req)) return send(401, { ok: false, message: 'control token required' });

      const url = new URL(req.url ?? '/', 'http://localhost');

      if (url.pathname === '/status' && req.method === 'GET') {
        const snap = engine.snapshot();
        return send(200, {
          ok: true,
          status: snap.status,
          statusDetail: snap.statusDetail,
          openPositions: Object.keys(snap.positions).length,
          equity: snap.account?.equity ?? null,
        });
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
