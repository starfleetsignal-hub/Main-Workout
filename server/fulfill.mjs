#!/usr/bin/env node
/**
 * Optional license-delivery server: Stripe payment -> signed license key.
 * Zero dependencies, Node 18+. See server/README.md.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { issueLicense, loadPrivateKey, parseArgs, publicKeyHexFromPrivate } from '../tools/license/lib.mjs';

const args = parseArgs(process.argv.slice(2));
const PORT = Number(args.port ?? process.env.PORT ?? 8787);
const STORE = path.resolve(process.cwd(), String(args.store ?? process.env.LICENSE_STORE ?? 'licenses.jsonl'));
const PLAN = String(args.plan ?? process.env.LICENSE_PLAN ?? 'lifetime');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const APP_NAME = process.env.APP_NAME ?? 'TradeRunner';

const privateKey = loadPrivateKey();
const publicKeyHex = publicKeyHexFromPrivate(privateKey);

/** sessionId -> record. Loaded from the append-only store at boot. */
const bySession = new Map();
if (existsSync(STORE)) {
  for (const line of readFileSync(STORE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.sessionId) bySession.set(rec.sessionId, rec);
    } catch {
      // skip malformed line
    }
  }
}

function persist(rec) {
  bySession.set(rec.sessionId, rec);
  appendFileSync(STORE, `${JSON.stringify(rec)}\n`);
}

/** Stripe's signature scheme: HMAC-SHA256 over "<timestamp>.<raw body>". */
function verifyStripeSignature(rawBody, header, secret, toleranceSeconds = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header
      .split(',')
      .map((p) => p.split('='))
      .filter((p) => p.length === 2)
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const given = String(parts.v1 ?? '');
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchStripeSession(sessionId) {
  if (!STRIPE_SECRET_KEY) return null;
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function issueFor(session) {
  const existing = bySession.get(session.id);
  if (existing) return existing; // idempotent: Stripe retries webhooks
  const email =
    session.customer_details?.email ?? session.customer_email ?? session.customer ?? `stripe:${session.id}`;
  const { key, payload } = issueLicense(privateKey, { sub: String(email), plan: PLAN, id: session.id });
  const rec = {
    sessionId: session.id,
    email,
    plan: PLAN,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
    issuedAt: new Date().toISOString(),
    expiresAt: payload.exp === null ? null : new Date(payload.exp * 1000).toISOString(),
    key,
  };
  persist(rec);
  console.log(`[license] issued ${payload.id} for ${email}`);
  return rec;
}

function html(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP_NAME} license</title><style>
:root{color-scheme:light dark}
body{font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:40px 20px;display:flex;justify-content:center;background:#0f1115;color:#e8eaf0}
main{max-width:640px;width:100%}
h1{font-size:24px;margin:0 0 8px}
p{color:#aab1c2}
code{display:block;word-break:break-all;background:#171a21;border:1px solid #262b36;border-radius:10px;padding:16px;margin:20px 0;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#7ee2b8}
.note{font-size:14px;color:#8b93a7}
</style></head><body><main>${body}</main></body></html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const send = (code, type, body) => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  };

  try {
    if (url.pathname === '/health') {
      return send(200, 'application/json', JSON.stringify({ ok: true, publicKeyHex, issued: bySession.size }));
    }

    if (url.pathname === '/webhook' && req.method === 'POST') {
      const raw = await readBody(req);
      if (!verifyStripeSignature(raw, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)) {
        console.warn('[webhook] rejected: bad signature');
        return send(400, 'text/plain', 'bad signature');
      }
      const event = JSON.parse(raw);
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.payment_status === 'paid' || session.status === 'complete') issueFor(session);
        else console.log(`[webhook] session ${session.id} not paid; ignoring`);
      }
      return send(200, 'application/json', JSON.stringify({ received: true }));
    }

    if (url.pathname === '/license' || url.pathname === '/claim') {
      const sessionId = url.searchParams.get('session_id');
      if (!sessionId) return send(400, 'application/json', JSON.stringify({ error: 'session_id required' }));

      let rec = bySession.get(sessionId);
      if (!rec) {
        // The webhook may not have landed yet; confirm payment directly with Stripe.
        const session = await fetchStripeSession(sessionId);
        if (session && (session.payment_status === 'paid' || session.status === 'complete')) rec = issueFor(session);
      }

      if (!rec) {
        if (url.pathname === '/license') {
          return send(404, 'application/json', JSON.stringify({ error: 'not_ready' }));
        }
        return send(
          202,
          'text/html',
          html(
            `<h1>Payment is still processing</h1><p>Refresh this page in a few seconds. If it does not appear within a minute, email support with your receipt.</p>`
          )
        );
      }

      if (url.pathname === '/license') {
        return send(200, 'application/json', JSON.stringify({ key: rec.key, plan: rec.plan, expiresAt: rec.expiresAt }));
      }
      return send(
        200,
        'text/html',
        html(
          `<h1>Your ${APP_NAME} license key</h1>
           <p>Open the app, tap <strong>Activate</strong>, and paste this key. Keep a copy — it is your proof of purchase.</p>
           <code>${rec.key}</code>
           <p class="note">Licensed to ${rec.email} · ${rec.plan}${rec.expiresAt ? ` · expires ${rec.expiresAt.slice(0, 10)}` : ' · no expiry'}</p>`
        )
      );
    }

    return send(404, 'text/plain', 'not found');
  } catch (e) {
    console.error('[server]', e);
    return send(500, 'text/plain', 'server error');
  }
});

server.listen(PORT, () => {
  console.log(`${APP_NAME} license server on :${PORT}`);
  console.log(`  public key : ${publicKeyHex}`);
  console.log(`  store      : ${STORE} (${bySession.size} issued)`);
  console.log(`  plan       : ${PLAN}`);
  if (!STRIPE_WEBHOOK_SECRET) console.warn('  WARNING: STRIPE_WEBHOOK_SECRET unset — /webhook will reject everything.');
});
