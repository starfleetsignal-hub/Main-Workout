import type { EngineSnapshot, EngineStatus } from '../engine/types';
import { fmtSigned } from '../engine/engine';

export interface EngineAlert {
  title: string;
  body: string;
}

/**
 * Pure decision logic for which engine events deserve a local notification.
 * Kept free of React/Notifications so it can be unit tested directly —
 * `useEngineAlerts` is just the thin wiring around this.
 */
export function computeEngineAlerts(
  prevStatus: EngineStatus,
  snapshot: EngineSnapshot,
  seenTradeIds: ReadonlySet<string>
): EngineAlert[] {
  const alerts: EngineAlert[] = [];

  if (snapshot.status !== prevStatus) {
    if (snapshot.status === 'halted') {
      alerts.push({ title: 'Trading halted', body: snapshot.statusDetail || 'Daily loss limit reached.' });
    } else if (snapshot.status === 'error') {
      alerts.push({ title: 'Engine error', body: snapshot.statusDetail || 'The engine stopped unexpectedly.' });
    }
  }

  for (const t of snapshot.trades) {
    if (seenTradeIds.has(t.id)) continue;
    if (t.exitReason === 'stop_loss') {
      const pnl = t.pnl ?? 0;
      const pnlPct = (t.pnlPct ?? 0) * 100;
      alerts.push({
        title: `${t.symbol} stopped out`,
        body: `Closed on a stop loss: ${fmtSigned(pnl, 2)} (${fmtSigned(pnlPct, 2)}%)`,
      });
    }
  }

  return alerts;
}
