#!/usr/bin/env node
/**
 * Activation server: seat counting and revocation for TradeRunner licenses.
 *
 * The offline signature check in the app is what makes a key unforgeable.
 * This server adds the two things a signature cannot do by itself:
 *
 *   - count how many devices are using one key, and refuse the next one
 *   - revoke a key after it has been sold
 *   - broadcast a "flatten everything now" command to every device trading
 *     under a license, for when you (or the customer) need an emergency
 *     stop and cannot reach the device or box that is running it directly
 *
 * It deliberately fails open on its own errors. If this server is down, a
 * paying customer keeps trading on their existing lease until the grace
 * window runs out; only a definite refusal (revoked, seat limit) locks them.
 *
 *   node server/activation.mjs --port 8788 --seats 3
 *
 * Environment:
 *   LICENSE_PRIVATE_KEY_PEM   signing key (or license-private.key in cwd)
 *   ACTIVATION_STORE          path to the ledger (default activations.jsonl)
 *   LEASE_HOURS               lease lifetime, default 72
 *   MAX_SEATS                 default seats per license, default 3
 *   ADMIN_TOKEN               required for the /admin routes
 */
import { createHmac, randomUUID, sign, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { loadPrivateKey, parseArgs, publicKeyHexFromPrivate, verifyLicense } from '../tools/license/lib.mjs';

const LEASE_PREFIX = 'TRL1';
const args = parseArgs(process.argv.slice(2));

const PORT = Number(args.port ?? process.env.PORT ?? 8788);
const STORE = path.resolve(process.cwd(), String(args.store ?? process.env.ACTIVATION_STORE ?? 'activations.jsonl'));
const LEASE_HOURS = Number(args['lease-hours'] ?? process.env.LEASE_HOURS ?? 72);
const MAX_SEATS = Number(args.seats ?? process.env.MAX_SEATS ?? 3);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

const privateKey = loadPrivateKey();
const publicKeyHex = publicKeyHexFromPrivate(privateKey);

/**
 * State, rebuilt from an append-only ledger at boot so the file is both the
 * database and the audit trail.
 *
 *   seats:    licenseId -> Map(deviceId -> {deviceName, platform, firstSeen, lastSeen})
 *   revoked:  licenseId -> reason
 *   limits:   licenseId -> maxSeats override
 *   flatten:  licenseId -> {reason, at} while a flatten command is pending
 */
const seats = new Map();
const revoked = new Map();
const limits = new Map();
const flatten = new Map();

function apply(rec) {
  switch (rec.type) {
    case 'activate': {
      if (!seats.has(rec.licenseId)) seats.set(rec.licenseId, new Map());
      const devices = seats.get(rec.licenseId);
      const existing = devices.get(rec.deviceId);
      devices.set(rec.deviceId, {
        deviceName: rec.deviceName,
        platform: rec.platform,
        firstSeen: existing?.firstSeen ?? rec.at,
        lastSeen: rec.at,
      });
      break;
    }
    case 'deactivate':
      seats.get(rec.licenseId)?.delete(rec.deviceId);
      break;
    case 'revoke':
      revoked.set(rec.licenseId, rec.reason ?? 'revoked');
      break;
    case 'unrevoke':
      revoked.delete(rec.licenseId);
      break;
    case 'limit':
      limits.set(rec.licenseId, Number(rec.maxSeats));
      break;
    case 'flatten-request':
      flatten.set(rec.licenseId, { reason: rec.reason ?? 'Requested by the license owner.', at: rec.at });
      break;
    case 'flatten-clear':
      flatten.delete(rec.licenseId);
      break;
    default:
      break;
  }
}

if (existsSync(STORE)) {
  for (const line of readFileSync(STORE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      apply(JSON.parse(line));
    } catch {
      // skip a malformed line rather than refusing to start
    }
  }
}

function record(rec) {
  const full = { ...rec, at: rec.at ?? new Date().toISOString(), id: randomUUID() };
  appendFileSync(STORE, `${JSON.stringify(full)}\n`);
  apply(full);
  return full;
}

function maxSeatsFor(licenseId) {
  return limits.get(licenseId) ?? MAX_SEATS;
}

/** Signs a lease with the same key that signs license keys. */
function issueLease(licenseId, deviceId, seatCount, maxSeats) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    lid: licenseId,
    did: deviceId,
    iat,
    exp: iat + Math.round(LEASE_HOURS * 3600),
    seats: seatCount,
    maxSeats,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(null, Buffer.from(`${LEASE_PREFIX}.${body}`, 'utf8'), privateKey);
  return `${LEASE_PREFIX}.${body}.${signature.toString('base64url')}`;
}

async function readJson(req, limitBytes = 64 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error('body too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function adminAuthorised(req) {
  if (!ADMIN_TOKEN) return false;
  const given = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (given.length !== ADMIN_TOKEN.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(ADMIN_TOKEN));
}

/** Rate limit per license id, so a loop cannot hammer the ledger. */
const recent = new Map();
function rateLimited(key, perMinute = 30) {
  const now = Date.now();
  const window = recent.get(key)?.filter((t) => now - t < 60_000) ?? [];
  window.push(now);
  recent.set(key, window);
  return window.length > perMinute;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const send = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  try {
    if (url.pathname === '/health') {
      return send(200, {
        ok: true,
        publicKeyHex,
        licenses: seats.size,
        revoked: revoked.size,
        leaseHours: LEASE_HOURS,
        maxSeats: MAX_SEATS,
      });
    }

    // ---- activation -------------------------------------------------------
    if (['/activate', '/renew', '/deactivate'].includes(url.pathname) && req.method === 'POST') {
      const body = await readJson(req);
      const { licenseKey, deviceId, deviceName = 'unknown', platform = 'unknown' } = body;

      if (typeof licenseKey !== 'string' || typeof deviceId !== 'string' || !deviceId) {
        return send(400, { ok: false, error: 'invalid_license', message: 'licenseKey and deviceId are required.' });
      }

      // The server verifies the signature too. A key it cannot verify was not
      // issued by us, whatever the app thinks.
      const check = verifyLicense(licenseKey, publicKeyHex);
      if (!check.ok) {
        return send(403, {
          ok: false,
          error: 'invalid_license',
          message: `License rejected (${check.reason}).`,
        });
      }
      const licenseId = check.payload.id;

      if (rateLimited(licenseId)) {
        return send(429, { ok: false, error: 'server_error', message: 'Too many activation attempts.' });
      }

      if (revoked.has(licenseId)) {
        return send(403, { ok: false, error: 'revoked', message: revoked.get(licenseId) });
      }

      if (url.pathname === '/deactivate') {
        record({ type: 'deactivate', licenseId, deviceId });
        return send(200, { ok: true });
      }

      const devices = seats.get(licenseId) ?? new Map();
      const maxSeats = maxSeatsFor(licenseId);
      const known = devices.has(deviceId);

      if (!known && devices.size >= maxSeats) {
        return send(409, {
          ok: false,
          error: 'seat_limit',
          seats: devices.size,
          maxSeats,
          message: `This license is active on ${devices.size} of ${maxSeats} devices.`,
        });
      }

      record({ type: 'activate', licenseId, deviceId, deviceName, platform });
      const count = seats.get(licenseId).size;
      const pendingFlatten = flatten.get(licenseId);
      return send(200, {
        ok: true,
        lease: issueLease(licenseId, deviceId, count, maxSeats),
        seats: count,
        maxSeats,
        // Present on every activate/renew response until an operator clears it
        // via /admin/flatten-clear, so every device that checks in (not just
        // whichever one happens to be first) sees and acts on the command.
        ...(pendingFlatten ? { flatten: true, flattenReason: pendingFlatten.reason } : {}),
      });
    }

    // ---- admin ------------------------------------------------------------
    if (url.pathname.startsWith('/admin/')) {
      if (!adminAuthorised(req)) return send(401, { ok: false, message: 'admin token required' });

      if (url.pathname === '/admin/licenses' && req.method === 'GET') {
        const out = [];
        for (const [licenseId, devices] of seats) {
          out.push({
            licenseId,
            seats: devices.size,
            maxSeats: maxSeatsFor(licenseId),
            revoked: revoked.has(licenseId),
            pendingFlatten: flatten.get(licenseId) ?? null,
            devices: [...devices.entries()].map(([id, d]) => ({ deviceId: id, ...d })),
          });
        }
        return send(200, { ok: true, licenses: out });
      }

      if (req.method === 'POST') {
        const body = await readJson(req);
        const licenseId = String(body.licenseId ?? '');
        if (!licenseId) return send(400, { ok: false, message: 'licenseId is required' });

        if (url.pathname === '/admin/revoke') {
          record({ type: 'revoke', licenseId, reason: String(body.reason ?? 'This license has been revoked.') });
          return send(200, { ok: true, revoked: licenseId });
        }
        if (url.pathname === '/admin/unrevoke') {
          record({ type: 'unrevoke', licenseId });
          return send(200, { ok: true, restored: licenseId });
        }
        if (url.pathname === '/admin/seats') {
          const maxSeats = Number(body.maxSeats);
          if (!Number.isFinite(maxSeats) || maxSeats < 1) {
            return send(400, { ok: false, message: 'maxSeats must be a positive number' });
          }
          record({ type: 'limit', licenseId, maxSeats });
          return send(200, { ok: true, licenseId, maxSeats });
        }
        if (url.pathname === '/admin/reset') {
          const devices = seats.get(licenseId);
          if (devices) for (const deviceId of [...devices.keys()]) record({ type: 'deactivate', licenseId, deviceId });
          return send(200, { ok: true, licenseId, seats: 0 });
        }
        if (url.pathname === '/admin/flatten') {
          record({ type: 'flatten-request', licenseId, reason: String(body.reason ?? '') || undefined });
          return send(200, { ok: true, licenseId, pendingFlatten: flatten.get(licenseId) });
        }
        if (url.pathname === '/admin/flatten-clear') {
          record({ type: 'flatten-clear', licenseId });
          return send(200, { ok: true, licenseId });
        }
      }
      return send(404, { ok: false, message: 'unknown admin route' });
    }

    return send(404, { ok: false, message: 'not found' });
  } catch (e) {
    console.error('[activation]', e);
    // Fail soft: the app treats a 5xx as "server unavailable", not as a refusal.
    return send(500, { ok: false, error: 'server_error', message: 'Activation server error' });
  }
});

server.listen(PORT, () => {
  console.log(`TradeRunner activation server on :${PORT}`);
  console.log(`  public key : ${publicKeyHex}`);
  console.log(`  store      : ${STORE} (${seats.size} licenses, ${revoked.size} revoked)`);
  console.log(`  lease      : ${LEASE_HOURS}h, ${MAX_SEATS} seats by default`);
  if (!ADMIN_TOKEN) console.warn('  WARNING: ADMIN_TOKEN unset — the /admin routes are disabled.');
});

export { issueLease, maxSeatsFor };
