import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlpacaClient, type AlpacaCredentials, type AlpacaFeed, type AlpacaMode } from '../broker/alpaca/rest';
import { errorMessage } from '../engine/engine';
import type { AccountSnapshot } from '../engine/types';
import { prefGet, prefSet, secureDelete, secureGet, secureSet } from '../storage/secure';

const CREDS_KEY = 'traderunner.alpaca.v1';
const MODE_KEY = 'traderunner.alpaca.mode.v1';

interface StoredCreds {
  keyId: string;
  secretKey: string;
}

interface CredentialsContextValue {
  credentials: AlpacaCredentials | null;
  loaded: boolean;
  /** Last successful account fetch, used to show equity before the engine starts. */
  account: AccountSnapshot | null;
  verifying: boolean;
  save: (
    keyId: string,
    secretKey: string,
    mode: AlpacaMode,
    feed: AlpacaFeed
  ) => Promise<{ ok: true; account: AccountSnapshot } | { ok: false; error: string }>;
  clear: () => Promise<void>;
  setMode: (mode: AlpacaMode) => Promise<void>;
  setFeed: (feed: AlpacaFeed) => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const CredentialsContext = createContext<CredentialsContextValue | undefined>(undefined);

export function CredentialsProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<AlpacaCredentials | null>(null);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      const [raw, prefs] = await Promise.all([
        secureGet(CREDS_KEY),
        prefGet<{ mode: AlpacaMode; feed: AlpacaFeed }>(MODE_KEY, { mode: 'paper', feed: 'iex' }),
      ]);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StoredCreds;
          if (parsed.keyId && parsed.secretKey) {
            setCredentials({ ...parsed, mode: prefs.mode, feed: prefs.feed });
          }
        } catch {
          // corrupt entry; ignore
        }
      }
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (keyId: string, secretKey: string, mode: AlpacaMode, feed: AlpacaFeed) => {
    const trimmedId = keyId.trim();
    const trimmedSecret = secretKey.trim();
    if (!trimmedId || !trimmedSecret) return { ok: false as const, error: 'Both the key ID and secret are required.' };
    setVerifying(true);
    try {
      const creds: AlpacaCredentials = { keyId: trimmedId, secretKey: trimmedSecret, mode, feed };
      const client = new AlpacaClient(creds);
      const acct = await client.verify();
      await secureSet(CREDS_KEY, JSON.stringify({ keyId: trimmedId, secretKey: trimmedSecret }));
      await prefSet(MODE_KEY, { mode, feed });
      setCredentials(creds);
      setAccount(acct);
      return { ok: true as const, account: acct };
    } catch (e) {
      return { ok: false as const, error: errorMessage(e) };
    } finally {
      setVerifying(false);
    }
  }, []);

  const clear = useCallback(async () => {
    await secureDelete(CREDS_KEY);
    setCredentials(null);
    setAccount(null);
  }, []);

  const setMode = useCallback(
    async (mode: AlpacaMode) => {
      setCredentials((prev) => (prev ? { ...prev, mode } : prev));
      await prefSet(MODE_KEY, { mode, feed: credentials?.feed ?? 'iex' });
    },
    [credentials?.feed]
  );

  const setFeed = useCallback(
    async (feed: AlpacaFeed) => {
      setCredentials((prev) => (prev ? { ...prev, feed } : prev));
      await prefSet(MODE_KEY, { mode: credentials?.mode ?? 'paper', feed });
    },
    [credentials?.mode]
  );

  const refreshAccount = useCallback(async () => {
    if (!credentials) return;
    try {
      setAccount(await new AlpacaClient(credentials).getAccount());
    } catch {
      // leave the previous snapshot in place
    }
  }, [credentials]);

  const value = useMemo(
    () => ({ credentials, loaded, account, verifying, save, clear, setMode, setFeed, refreshAccount }),
    [credentials, loaded, account, verifying, save, clear, setMode, setFeed, refreshAccount]
  );

  return <CredentialsContext.Provider value={value}>{children}</CredentialsContext.Provider>;
}

export function useCredentials(): CredentialsContextValue {
  const ctx = useContext(CredentialsContext);
  if (!ctx) throw new Error('useCredentials must be used inside a CredentialsProvider');
  return ctx;
}
