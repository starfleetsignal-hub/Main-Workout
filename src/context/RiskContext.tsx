import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { prefGet, prefSet } from '../storage/secure';

const RISK_ACK_KEY = 'traderunner.riskAcknowledged.v1';

/** Bumped if the terms change materially, so returning users see the gate again. */
export const RISK_TERMS_VERSION = 1;

interface RiskContextValue {
  loaded: boolean;
  acknowledged: boolean;
  acknowledge: () => Promise<void>;
}

const RiskContext = createContext<RiskContextValue | undefined>(undefined);

export function RiskProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await prefGet<number>(RISK_ACK_KEY, 0);
      setAcknowledged(stored >= RISK_TERMS_VERSION);
      setLoaded(true);
    })();
  }, []);

  const acknowledge = useCallback(async () => {
    await prefSet(RISK_ACK_KEY, RISK_TERMS_VERSION);
    setAcknowledged(true);
  }, []);

  return <RiskContext.Provider value={{ loaded, acknowledged, acknowledge }}>{children}</RiskContext.Provider>;
}

export function useRisk(): RiskContextValue {
  const ctx = useContext(RiskContext);
  if (!ctx) throw new Error('useRisk must be used inside a RiskProvider');
  return ctx;
}
