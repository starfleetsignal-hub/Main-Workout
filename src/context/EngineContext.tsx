import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { AlpacaClient } from '../broker/alpaca/rest';
import { AlpacaStreams } from '../broker/alpaca/stream';
import { TradingEngine } from '../engine/engine';
import { DEFAULT_PARAMETERS, normalizeParameters, type Parameters } from '../engine/parameters';
import type { EngineSnapshot } from '../engine/types';
import { prefGet, prefSet } from '../storage/secure';
import { useCredentials } from './CredentialsContext';
import { useLicense } from './LicenseContext';

const PARAMS_KEY = 'traderunner.parameters.v1';

const EMPTY_SNAPSHOT: EngineSnapshot = {
  status: 'stopped',
  statusDetail: 'Not running',
  account: null,
  clock: null,
  symbols: {},
  positions: {},
  trades: [],
  activity: [],
  signals: {},
  news: [],
  tradesToday: 0,
  realizedPnlToday: 0,
  streams: { stocks: 'off', crypto: 'off', news: 'off' },
  lastTickAt: 0,
};

interface EngineContextValue {
  snapshot: EngineSnapshot;
  parameters: Parameters;
  paramsLoaded: boolean;
  /** True when credentials exist and the engine object is constructed. */
  ready: boolean;
  start: () => Promise<void>;
  stop: (flatten?: boolean) => Promise<void>;
  resume: () => Promise<void>;
  flattenAll: () => Promise<void>;
  closePosition: (symbol: string) => Promise<void>;
  updateParameters: (next: Partial<Parameters>) => void;
  resetParameters: () => void;
}

const EngineContext = createContext<EngineContextValue | undefined>(undefined);

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const { credentials } = useCredentials();
  const { isUnlocked } = useLicense();
  const [parameters, setParameters] = useState<Parameters>(DEFAULT_PARAMETERS);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(EMPTY_SNAPSHOT);
  const engineRef = useRef<TradingEngine | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Load saved parameters once.
  useEffect(() => {
    (async () => {
      const stored = await prefGet<unknown>(PARAMS_KEY, null);
      setParameters(normalizeParameters(stored ?? DEFAULT_PARAMETERS));
      setParamsLoaded(true);
    })();
  }, []);

  // (Re)build the engine whenever the broker credentials change.
  useEffect(() => {
    if (!paramsLoaded) return;
    unsubRef.current?.();
    unsubRef.current = null;
    const prev = engineRef.current;
    if (prev) void prev.stop('engine_stop', false);
    engineRef.current = null;
    setSnapshot(EMPTY_SNAPSHOT);

    if (!credentials) return;
    const broker = new AlpacaClient(credentials);
    const streams = new AlpacaStreams(credentials);
    const engine = new TradingEngine({ broker, streams }, parameters);
    engineRef.current = engine;
    unsubRef.current = engine.subscribe(setSnapshot);

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      void engine.stop('engine_stop', false);
      engineRef.current = null;
    };
    // `parameters` is deliberately excluded: live updates go through setParameters below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, paramsLoaded]);

  // Losing the license stops the engine immediately.
  useEffect(() => {
    if (!isUnlocked && engineRef.current) void engineRef.current.stop('engine_stop', false);
  }, [isUnlocked]);

  // Backgrounding the app does not kill an open position, but we surface it:
  // the engine keeps running while the JS runtime is alive, and reconciles on resume.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && engineRef.current) {
        // Snapshot refresh; the engine's own housekeeping does the real work.
        setSnapshot(engineRef.current.snapshot());
      }
    });
    return () => sub.remove();
  }, []);

  const updateParameters = useCallback((patch: Partial<Parameters>) => {
    setParameters((prev) => {
      const next = normalizeParameters({ ...prev, ...patch });
      void prefSet(PARAMS_KEY, next);
      engineRef.current?.setParameters(next);
      return next;
    });
  }, []);

  const resetParameters = useCallback(() => {
    const next = normalizeParameters(DEFAULT_PARAMETERS);
    setParameters(next);
    void prefSet(PARAMS_KEY, next);
    engineRef.current?.setParameters(next);
  }, []);

  const start = useCallback(async () => {
    if (!isUnlocked) return;
    await engineRef.current?.start();
  }, [isUnlocked]);

  const stop = useCallback(async (flatten = false) => {
    await engineRef.current?.stop('manual', flatten);
  }, []);

  const resume = useCallback(async () => {
    if (!isUnlocked) return;
    await engineRef.current?.resume();
  }, [isUnlocked]);

  const flattenAll = useCallback(async () => {
    await engineRef.current?.flattenAll('manual');
  }, []);

  const closePosition = useCallback(async (symbol: string) => {
    await engineRef.current?.closePosition(symbol);
  }, []);

  const value = useMemo(
    () => ({
      snapshot,
      parameters,
      paramsLoaded,
      ready: engineRef.current !== null,
      start,
      stop,
      resume,
      flattenAll,
      closePosition,
      updateParameters,
      resetParameters,
    }),
    [snapshot, parameters, paramsLoaded, start, stop, resume, flattenAll, closePosition, updateParameters, resetParameters]
  );

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used inside an EngineProvider');
  return ctx;
}
