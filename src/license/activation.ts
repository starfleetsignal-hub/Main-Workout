import {
  base64UrlDecode,
  hexToBytes,
  utf8Bytes,
  verifyLicenseKey,
  type LicenseCheck,
  type VerifiedLicense,
} from './format';
import * as ed from '@noble/ed25519';

/**
 * Server-side activation.
 *
 * The offline signature check still runs first and is still the thing that
 * makes a key unforgeable. Activation adds the part a signature cannot do on
 * its own: counting how many devices are using one key, and letting you
 * revoke a key after you have sold it.
 *
 * The design goal is that the server can be down without stranding a paying
 * customer. An activation returns a signed lease with an expiry; the app keeps
 * working offline until that lease runs out, then tries to renew. Only a
 * definite "no" from the server (revoked, or seat limit exceeded) locks the
 * app immediately.
 */

export const ACTIVATION_PREFIX = 'TRL1';

export interface LeasePayload {
  v: 1;
  /** The license this lease belongs to. */
  lid: string;
  /** The device this lease was issued to. */
  did: string;
  /** Issued at, unix seconds. */
  iat: number;
  /** Lease expiry, unix seconds. After this the app must renew. */
  exp: number;
  /** Seats used and allowed, for display. */
  seats: number;
  maxSeats: number;
}

export interface Lease extends LeasePayload {
  token: string;
}

/** A pending "flatten everything now" command broadcast from the activation server. */
export interface FlattenNotice {
  reason: string;
}

export type ActivationState =
  | { status: 'unknown' }
  | { status: 'active'; lease: Lease; pendingFlatten: FlattenNotice | null }
  | { status: 'grace'; lease: Lease; until: number }
  | { status: 'revoked'; reason: string }
  | { status: 'seat_limit'; seats: number; maxSeats: number }
  | { status: 'offline'; detail: string };

export interface ActivationConfig {
  /** Base URL of the activation server. Empty disables activation entirely. */
  serverUrl: string;
  /** Public key the lease tokens are verified against (hex, 32 bytes). */
  publicKeyHex: string;
  /** How long a lease may be used past its expiry when the server is unreachable. */
  graceSeconds: number;
}

/**
 * Verifies a lease token, which is signed the same way a license key is.
 * Format: TRL1.<base64url payload>.<base64url signature>
 */
export function verifyLease(token: string, publicKeyHex: string, nowSeconds = Math.floor(Date.now() / 1000)):
  | { ok: true; lease: Lease }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' } {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== ACTIVATION_PREFIX) return { ok: false, reason: 'malformed' };
  let payload: LeasePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (
    !payload ||
    payload.v !== 1 ||
    typeof payload.lid !== 'string' ||
    typeof payload.did !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }
  let valid = false;
  try {
    valid = ed.verify(
      base64UrlDecode(parts[2]),
      utf8Bytes(`${ACTIVATION_PREFIX}.${parts[1]}`),
      hexToBytes(publicKeyHex)
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'bad_signature' };
  if (payload.exp <= nowSeconds) return { ok: false, reason: 'expired' };
  return { ok: true, lease: { ...payload, token: token.trim() } };
}

export type ActivationAction = 'activate' | 'renew' | 'deactivate';

export interface ActivateRequest {
  licenseKey: string;
  deviceId: string;
  deviceName: string;
  platform: string;
}

export interface ActivationResponse {
  ok: boolean;
  lease?: string;
  error?: 'revoked' | 'seat_limit' | 'invalid_license' | 'server_error';
  message?: string;
  seats?: number;
  maxSeats?: number;
  /**
   * Set on every activate/renew response while an operator has an emergency
   * flatten pending for this license. Not part of the signed lease: it is
   * advisory, not a security control, and the worst a forged copy of it can
   * do is make the app close its own positions early.
   */
  flatten?: boolean;
  flattenReason?: string;
}

/**
 * Calls the activation server. Network failures are reported as `offline`
 * rather than as a refusal, because a customer with a valid key should not be
 * locked out by your server having a bad day.
 */
export async function requestActivation(
  config: ActivationConfig,
  req: ActivateRequest,
  action: ActivationAction = 'activate',
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000
): Promise<ActivationState> {
  if (!config.serverUrl) return { status: 'unknown' };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(`${config.serverUrl.replace(/\/$/, '')}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller?.signal,
    });
    const body = (await res.json()) as ActivationResponse;

    if (!res.ok || !body.ok) {
      if (body?.error === 'revoked') {
        return { status: 'revoked', reason: body.message ?? 'This license has been revoked.' };
      }
      if (body?.error === 'seat_limit') {
        return { status: 'seat_limit', seats: body.seats ?? 0, maxSeats: body.maxSeats ?? 0 };
      }
      if (body?.error === 'invalid_license') {
        return { status: 'revoked', reason: body.message ?? 'The server did not recognise this license.' };
      }
      // A 5xx is the server's problem, not the customer's.
      return { status: 'offline', detail: body?.message ?? `Activation server returned ${res.status}` };
    }

    if (action === 'deactivate') return { status: 'unknown' };
    if (!body.lease) return { status: 'offline', detail: 'Activation server returned no lease' };

    const verified = verifyLease(body.lease, config.publicKeyHex);
    if (!verified.ok) {
      // A lease we cannot verify is worthless; treat it as the server being
      // misconfigured rather than as a refusal.
      return { status: 'offline', detail: `Lease failed verification (${verified.reason})` };
    }
    return {
      status: 'active',
      lease: verified.lease,
      pendingFlatten: body.flatten ? { reason: body.flattenReason ?? 'Requested by the license owner.' } : null,
    };
  } catch (e) {
    return { status: 'offline', detail: e instanceof Error ? e.message : String(e) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Decides whether the app should be unlocked, given the offline signature
 * check and whatever the activation server last said.
 */
export interface UnlockDecision {
  unlocked: boolean;
  /** Why it is locked, or a warning to show while it is unlocked. */
  message: string | null;
  /** True when running on an expired lease that has not been renewed yet. */
  inGrace: boolean;
  needsRenewal: boolean;
}

export function decideUnlock(
  check: LicenseCheck,
  activation: ActivationState,
  config: ActivationConfig,
  nowSeconds = Math.floor(Date.now() / 1000)
): UnlockDecision {
  // The signature is the foundation. Nothing the server says can unlock a key
  // that does not verify.
  if (!check.ok) return { unlocked: false, message: null, inGrace: false, needsRenewal: false };

  // Activation is optional: a build with no server configured behaves exactly
  // as it did before, verifying offline only.
  if (!config.serverUrl) return { unlocked: true, message: null, inGrace: false, needsRenewal: false };

  switch (activation.status) {
    case 'revoked':
      return { unlocked: false, message: activation.reason, inGrace: false, needsRenewal: false };
    case 'seat_limit':
      return {
        unlocked: false,
        message: `This license is already active on ${activation.seats} of ${activation.maxSeats} devices. Deactivate another device first.`,
        inGrace: false,
        needsRenewal: false,
      };
    case 'active': {
      const remaining = activation.lease.exp - nowSeconds;
      return {
        unlocked: true,
        message: null,
        inGrace: false,
        // Renew well before the lease lapses so a brief outage is invisible.
        needsRenewal: remaining < 0.5 * (activation.lease.exp - activation.lease.iat),
      };
    }
    case 'grace':
      return {
        unlocked: nowSeconds < activation.until,
        message:
          nowSeconds < activation.until
            ? 'Could not reach the activation server. The app keeps working for now.'
            : 'This device has not checked in for too long. Connect to the internet to continue.',
        inGrace: true,
        needsRenewal: true,
      };
    case 'offline':
      // No lease at all and no server: fall back to the offline check so a
      // first activation attempt during an outage is not fatal.
      return {
        unlocked: true,
        message: 'Could not reach the activation server. Running on the offline license check.',
        inGrace: true,
        needsRenewal: true,
      };
    case 'unknown':
    default:
      return { unlocked: true, message: null, inGrace: false, needsRenewal: true };
  }
}

/** Builds the grace state from a stored lease that has expired. */
export function toGrace(lease: Lease, graceSeconds: number): ActivationState {
  return { status: 'grace', lease, until: lease.exp + graceSeconds };
}

export function describeLicense(license: VerifiedLicense): string {
  return `${license.sub} · ${license.plan}`;
}

export { verifyLicenseKey };
