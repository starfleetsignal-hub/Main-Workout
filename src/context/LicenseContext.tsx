import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  decideUnlock,
  requestActivation,
  toGrace,
  verifyLease,
  type ActivationAction,
  type ActivationConfig,
  type ActivationState,
  type FlattenNotice,
  type Lease,
} from '../license/activation';
import { getDeviceId, getDeviceName, getPlatform } from '../license/device';
import {
  base64UrlDecode,
  describeLicenseFailure,
  normalizeKeyInput,
  verifyLicenseKey,
  type VerifiedLicense,
} from '../license/format';
import { ACTIVATION_GRACE_HOURS, ACTIVATION_SERVER_URL, LICENSE_PUBLIC_KEY_HEX } from '../license/publicKey';
import { secureDelete, secureGet, secureSet } from '../storage/secure';

const LICENSE_STORAGE_KEY = 'traderunner.license.v1';
const LEASE_STORAGE_KEY = 'traderunner.lease.v1';

interface LicenseContextValue {
  license: VerifiedLicense | null;
  loaded: boolean;
  isUnlocked: boolean;
  lockReason: string | null;
  /** A non-fatal notice, e.g. running offline on a stale lease. */
  notice: string | null;
  activation: ActivationState;
  /** True when this build checks in with an activation server at all. */
  activationEnabled: boolean;
  seats: { used: number; max: number } | null;
  /** A pending remote "flatten everything" command from the activation server, if any. */
  remoteFlatten: FlattenNotice | null;
  deviceId: string | null;
  busy: boolean;
  activate: (rawKey: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  deactivate: () => Promise<void>;
  /** Re-check with the activation server now. */
  refreshActivation: () => Promise<void>;
  daysRemaining: number | null;
}

const LicenseContext = createContext<LicenseContextValue | undefined>(undefined);

const CONFIG: ActivationConfig = {
  serverUrl: ACTIVATION_SERVER_URL,
  publicKeyHex: LICENSE_PUBLIC_KEY_HEX,
  graceSeconds: ACTIVATION_GRACE_HOURS * 3600,
};

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [license, setLicense] = useState<VerifiedLicense | null>(null);
  const [activation, setActivation] = useState<ActivationState>({ status: 'unknown' });
  const [loaded, setLoaded] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const renewing = useRef(false);

  const activationEnabled = CONFIG.serverUrl.length > 0;

  /** Runs the server check for a key we have already verified offline. */
  const checkIn = useCallback(
    async (key: string, action: ActivationAction = 'renew'): Promise<ActivationState> => {
      if (!activationEnabled) return { status: 'unknown' };
      const id = deviceId ?? (await getDeviceId());
      if (!deviceId) setDeviceId(id);
      const state = await requestActivation(
        CONFIG,
        { licenseKey: key, deviceId: id, deviceName: getDeviceName(), platform: getPlatform() },
        action
      );
      if (state.status === 'active') {
        await secureSet(LEASE_STORAGE_KEY, state.lease.token);
      } else if (state.status === 'revoked' || state.status === 'seat_limit') {
        await secureDelete(LEASE_STORAGE_KEY);
      }
      return state;
    },
    [activationEnabled, deviceId]
  );

  // Initial load: verify the stored key offline, then reconcile with the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getDeviceId();
      if (!cancelled) setDeviceId(id);

      const stored = await secureGet(LICENSE_STORAGE_KEY);
      if (!stored) {
        if (!cancelled) setLoaded(true);
        return;
      }

      const check = verifyLicenseKey(stored, LICENSE_PUBLIC_KEY_HEX);
      if (!check.ok) {
        if (check.reason !== 'no_public_key') await secureDelete(LICENSE_STORAGE_KEY);
        if (!cancelled) {
          setLicense(null);
          setLockReason(describeLicenseFailure(check.reason));
          setLoaded(true);
        }
        return;
      }

      if (!cancelled) setLicense(check.license);

      if (!activationEnabled) {
        if (!cancelled) setLoaded(true);
        return;
      }

      // Start from the stored lease so the app is usable before the network
      // round-trip finishes, then refresh in the background.
      const storedLease = await secureGet(LEASE_STORAGE_KEY);
      if (storedLease) {
        const verified = verifyLease(storedLease, LICENSE_PUBLIC_KEY_HEX);
        if (verified.ok && !cancelled) setActivation({ status: 'active', lease: verified.lease, pendingFlatten: null });
        else if (!cancelled) {
          const expired = parseLeaseAnyway(storedLease);
          if (expired) setActivation(toGrace(expired, CONFIG.graceSeconds));
        }
      }
      if (!cancelled) setLoaded(true);

      const state = await requestActivation(
        CONFIG,
        { licenseKey: stored, deviceId: id, deviceName: getDeviceName(), platform: getPlatform() },
        'renew'
      );
      if (cancelled) return;
      if (state.status === 'active') {
        await secureSet(LEASE_STORAGE_KEY, state.lease.token);
        setActivation(state);
      } else if (state.status === 'revoked' || state.status === 'seat_limit') {
        await secureDelete(LEASE_STORAGE_KEY);
        setActivation(state);
      } else if (storedLease) {
        // Server unreachable: keep whatever lease we already had.
        const verified = verifyLease(storedLease, LICENSE_PUBLIC_KEY_HEX);
        setActivation(verified.ok ? { status: 'active', lease: verified.lease, pendingFlatten: null } : state);
      } else {
        setActivation(state);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activationEnabled]);

  const decision = useMemo(
    () => decideUnlock(license ? { ok: true, license } : { ok: false, reason: 'malformed' }, activation, CONFIG),
    [license, activation]
  );

  // Renew the lease in the background when it is halfway through its life.
  useEffect(() => {
    if (!license || !activationEnabled || !decision.needsRenewal) return;
    if (renewing.current) return;
    renewing.current = true;
    (async () => {
      const state = await checkIn(license.key, 'renew');
      if (state.status !== 'unknown') setActivation(state);
      renewing.current = false;
    })();
  }, [license, activationEnabled, decision.needsRenewal, checkIn]);

  // Re-check expiry every minute so a key that lapses mid-session locks.
  useEffect(() => {
    if (!license) return;
    const id = setInterval(() => {
      const res = verifyLicenseKey(license.key, LICENSE_PUBLIC_KEY_HEX);
      if (!res.ok) {
        setLicense(null);
        setLockReason(describeLicenseFailure(res.reason));
        void secureDelete(LICENSE_STORAGE_KEY);
        void secureDelete(LEASE_STORAGE_KEY);
      }
      // Nudge the lease state so an expired lease drops into grace on time.
      setActivation((prev) => {
        if (prev.status !== 'active') return prev;
        if (prev.lease.exp * 1000 > Date.now()) return prev;
        return toGrace(prev.lease, CONFIG.graceSeconds);
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [license]);

  const activate = useCallback(
    async (rawKey: string) => {
      const key = normalizeKeyInput(rawKey);
      if (!key) return { ok: false as const, error: 'Enter your license key.' };

      const check = verifyLicenseKey(key, LICENSE_PUBLIC_KEY_HEX);
      if (!check.ok) return { ok: false as const, error: describeLicenseFailure(check.reason) };

      if (!activationEnabled) {
        await secureSet(LICENSE_STORAGE_KEY, key);
        setLicense(check.license);
        setLockReason(null);
        return { ok: true as const };
      }

      setBusy(true);
      try {
        const state = await checkIn(key, 'activate');
        if (state.status === 'revoked') return { ok: false as const, error: state.reason };
        if (state.status === 'seat_limit') {
          return {
            ok: false as const,
            error: `This license is already active on ${state.seats} of ${state.maxSeats} devices. Deactivate one of them first.`,
          };
        }
        // `offline` still activates: the signature is valid and the server is
        // the one having trouble.
        await secureSet(LICENSE_STORAGE_KEY, key);
        setLicense(check.license);
        setActivation(state);
        setLockReason(null);
        return { ok: true as const };
      } finally {
        setBusy(false);
      }
    },
    [activationEnabled, checkIn]
  );

  const deactivate = useCallback(async () => {
    const key = license?.key;
    if (key && activationEnabled) {
      // Best effort: free the seat so the customer can move to another device.
      await checkIn(key, 'deactivate').catch(() => undefined);
    }
    await secureDelete(LICENSE_STORAGE_KEY);
    await secureDelete(LEASE_STORAGE_KEY);
    setLicense(null);
    setActivation({ status: 'unknown' });
    setLockReason(null);
  }, [license, activationEnabled, checkIn]);

  const refreshActivation = useCallback(async () => {
    if (!license) return;
    setBusy(true);
    try {
      const state = await checkIn(license.key, 'renew');
      if (state.status !== 'unknown') setActivation(state);
    } finally {
      setBusy(false);
    }
  }, [license, checkIn]);

  const daysRemaining = useMemo(() => {
    if (!license || license.exp === null) return null;
    return Math.max(0, Math.ceil((license.exp * 1000 - Date.now()) / 86_400_000));
  }, [license]);

  const seats = useMemo(() => {
    if (activation.status === 'active') {
      return { used: activation.lease.seats, max: activation.lease.maxSeats };
    }
    if (activation.status === 'grace') return { used: activation.lease.seats, max: activation.lease.maxSeats };
    if (activation.status === 'seat_limit') return { used: activation.seats, max: activation.maxSeats };
    return null;
  }, [activation]);

  const remoteFlatten = activation.status === 'active' ? activation.pendingFlatten : null;

  const value = useMemo(
    () => ({
      license,
      loaded,
      isUnlocked: license !== null && decision.unlocked,
      lockReason: lockReason ?? (decision.unlocked ? null : decision.message),
      notice: decision.unlocked ? decision.message : null,
      activation,
      activationEnabled,
      seats,
      remoteFlatten,
      deviceId,
      busy,
      activate,
      deactivate,
      refreshActivation,
      daysRemaining,
    }),
    [
      license,
      loaded,
      decision,
      remoteFlatten,
      lockReason,
      activation,
      activationEnabled,
      seats,
      deviceId,
      busy,
      activate,
      deactivate,
      refreshActivation,
      daysRemaining,
    ]
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

/**
 * Reads an expired lease's payload so it can still anchor the grace window.
 * The signature is not re-checked here because the lease has already failed
 * verification for being expired; the payload is used only for its dates.
 */
function parseLeaseAnyway(token: string): Lease | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    if (typeof json?.exp !== 'number') return null;
    return { ...json, token };
  } catch {
    return null;
  }
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside a LicenseProvider');
  return ctx;
}
