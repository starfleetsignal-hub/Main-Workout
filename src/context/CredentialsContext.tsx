import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createConnection, describeVenue, getVenue } from '../broker/registry';
import type { VenueCredentials, VenueDescriptor, VenueId } from '../broker/venues';
import { errorMessage } from '../engine/engine';
import type { AccountSnapshot } from '../engine/types';
import { prefGet, prefSet, secureDelete, secureGet, secureSet } from '../storage/secure';

const CREDS_KEY = 'traderunner.credentials.v2';
const VENUE_KEY = 'traderunner.venue.v2';

interface CredentialsContextValue {
  credentials: VenueCredentials | null;
  venue: VenueDescriptor | null;
  loaded: boolean;
  account: AccountSnapshot | null;
  verifying: boolean;
  /** Verifies against the venue, then stores on success. */
  save: (creds: VenueCredentials) => Promise<{ ok: true; account: AccountSnapshot } | { ok: false; error: string }>;
  clear: () => Promise<void>;
  setMode: (mode: string) => Promise<void>;
  setFeed: (feed: string) => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const CredentialsContext = createContext<CredentialsContextValue | undefined>(undefined);

export function CredentialsProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<VenueCredentials | null>(null);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      const [raw, prefs] = await Promise.all([
        secureGet(CREDS_KEY),
        prefGet<{ mode?: string; feed?: string }>(VENUE_KEY, {}),
      ]);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as VenueCredentials;
          if (parsed?.venue && describeVenue(parsed.venue)) {
            setCredentials({ ...parsed, ...prefs });
          }
        } catch {
          // corrupt entry; ignore rather than crash on launch
        }
      }
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (creds: VenueCredentials) => {
    const factory = getVenue(creds.venue);
    const problem = factory.validate(creds);
    if (problem) return { ok: false as const, error: problem };

    setVerifying(true);
    try {
      const broker = factory.createBroker(creds);
      const acct = await broker.getAccount();
      await secureSet(CREDS_KEY, JSON.stringify(creds));
      await prefSet(VENUE_KEY, { mode: creds.mode, feed: creds.feed });
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

  const patch = useCallback(async (next: Partial<VenueCredentials>) => {
    setCredentials((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...next } as VenueCredentials;
      void secureSet(CREDS_KEY, JSON.stringify(merged));
      void prefSet(VENUE_KEY, { mode: merged.mode, feed: merged.feed });
      return merged;
    });
  }, []);

  const setMode = useCallback((mode: string) => patch({ mode }), [patch]);
  const setFeed = useCallback((feed: string) => patch({ feed }), [patch]);

  const refreshAccount = useCallback(async () => {
    if (!credentials) return;
    try {
      const { broker } = createConnection(credentials);
      setAccount(await broker.getAccount());
    } catch {
      // keep the previous snapshot rather than blanking the screen
    }
  }, [credentials]);

  const venue = useMemo(() => (credentials ? describeVenue(credentials.venue) : null), [credentials]);

  const value = useMemo(
    () => ({ credentials, venue, loaded, account, verifying, save, clear, setMode, setFeed, refreshAccount }),
    [credentials, venue, loaded, account, verifying, save, clear, setMode, setFeed, refreshAccount]
  );

  return <CredentialsContext.Provider value={value}>{children}</CredentialsContext.Provider>;
}

export function useCredentials(): CredentialsContextValue {
  const ctx = useContext(CredentialsContext);
  if (!ctx) throw new Error('useCredentials must be used inside a CredentialsProvider');
  return ctx;
}

export type { VenueCredentials, VenueId };
