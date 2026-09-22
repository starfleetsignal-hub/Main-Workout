import { useEffect, useRef } from 'react';
import type { EngineSnapshot } from '../engine/types';
import { computeEngineAlerts } from './engineAlertRules';
import { notify } from './notifications';

/**
 * Fires a local notification for engine events worth knowing about even when
 * the app isn't being watched: a halt, an error, or a stop-loss exit.
 * Routine activity (entries, take-profits, manual exits) stays silent so
 * alerts don't turn into noise on an app that trades frequently. The actual
 * rule set lives in `computeEngineAlerts`, kept pure and unit tested; this
 * hook is just the React wiring (refs for dedup, firing `notify`).
 */
export function useEngineAlerts(snapshot: EngineSnapshot, enabled: boolean): void {
  const prevStatusRef = useRef(snapshot.status);
  const seenTradeIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    // Skip the state this hook was mounted with (e.g. already halted on a
    // cold start) so it only reports transitions it actually witnessed.
    if (!primedRef.current) {
      primedRef.current = true;
      prevStatusRef.current = snapshot.status;
      for (const t of snapshot.trades) seenTradeIdsRef.current.add(t.id);
      return;
    }

    if (enabled) {
      for (const alert of computeEngineAlerts(prevStatusRef.current, snapshot, seenTradeIdsRef.current)) {
        void notify(alert.title, alert.body);
      }
    }

    prevStatusRef.current = snapshot.status;
    for (const t of snapshot.trades) seenTradeIdsRef.current.add(t.id);
  }, [snapshot, enabled]);
}
