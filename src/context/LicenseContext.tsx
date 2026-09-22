import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  describeLicenseFailure,
  normalizeKeyInput,
  verifyLicenseKey,
  type VerifiedLicense,
} from '../license/format';
import { LICENSE_PUBLIC_KEY_HEX } from '../license/publicKey';
import { secureDelete, secureGet, secureSet } from '../storage/secure';

const LICENSE_STORAGE_KEY = 'traderunner.license.v1';

interface LicenseContextValue {
  /** null while we are still reading storage. */
  license: VerifiedLicense | null;
  loaded: boolean;
  /** True only when a signed, unexpired key is present. */
  isUnlocked: boolean;
  /** Set when a stored key stopped verifying (expired or tampered with). */
  lockReason: string | null;
  activate: (rawKey: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  deactivate: () => Promise<void>;
  /** Days until expiry, or null for perpetual licenses. */
  daysRemaining: number | null;
}

const LicenseContext = createContext<LicenseContextValue | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [license, setLicense] = useState<VerifiedLicense | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    const stored = await secureGet(LICENSE_STORAGE_KEY);
    if (stored) {
      const res = verifyLicenseKey(stored, LICENSE_PUBLIC_KEY_HEX);
      if (res.ok) {
        setLicense(res.license);
        setLockReason(null);
      } else {
        // A stored key that no longer verifies is removed, so the app re-locks.
        setLicense(null);
        setLockReason(describeLicenseFailure(res.reason));
        if (res.reason !== 'no_public_key') await secureDelete(LICENSE_STORAGE_KEY);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-check expiry every minute so a key that lapses mid-session locks the app.
  useEffect(() => {
    if (!license || license.exp === null) return;
    const id = setInterval(() => {
      const res = verifyLicenseKey(license.key, LICENSE_PUBLIC_KEY_HEX);
      if (!res.ok) {
        setLicense(null);
        setLockReason(describeLicenseFailure(res.reason));
        void secureDelete(LICENSE_STORAGE_KEY);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [license]);

  const activate = useCallback(async (rawKey: string) => {
    const key = normalizeKeyInput(rawKey);
    if (!key) return { ok: false as const, error: 'Enter your license key.' };
    const res = verifyLicenseKey(key, LICENSE_PUBLIC_KEY_HEX);
    if (!res.ok) return { ok: false as const, error: describeLicenseFailure(res.reason) };
    await secureSet(LICENSE_STORAGE_KEY, key);
    setLicense(res.license);
    setLockReason(null);
    return { ok: true as const };
  }, []);

  const deactivate = useCallback(async () => {
    await secureDelete(LICENSE_STORAGE_KEY);
    setLicense(null);
    setLockReason(null);
  }, []);

  const daysRemaining = useMemo(() => {
    if (!license || license.exp === null) return null;
    return Math.max(0, Math.ceil((license.exp * 1000 - Date.now()) / 86_400_000));
  }, [license]);

  const value = useMemo(
    () => ({
      license,
      loaded,
      isUnlocked: license !== null,
      lockReason,
      activate,
      deactivate,
      daysRemaining,
    }),
    [license, loaded, lockReason, activate, deactivate, daysRemaining]
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside a LicenseProvider');
  return ctx;
}
