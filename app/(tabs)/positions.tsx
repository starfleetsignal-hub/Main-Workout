import { useIsFocused } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatRelative } from '../../src/components/ActivityRow';
import { Chip } from '../../src/components/Chip';
import { EquityCurve } from '../../src/components/EquityCurve';
import { PositionCard } from '../../src/components/PositionCard';
import { StatTile } from '../../src/components/StatTile';
import { useEngine } from '../../src/context/EngineContext';
import { computePerformanceStats } from '../../src/engine/analytics';
import { fmtPrice, fmtSigned } from '../../src/engine/engine';
import type { TradeRecord } from '../../src/engine/types';
import { colors, pnlColor } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { radius, shared, spacing } from '../../src/theme/layout';

export default function PositionsScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { snapshot, closePosition } = useEngine();
  const positions = Object.values(snapshot.positions);
  const closed = snapshot.trades;

  const stats = useMemo(
    () => computePerformanceStats(snapshot.equityHistory, closed),
    [snapshot.equityHistory, closed]
  );

  const onClose = (symbol: string) => {
    Alert.alert('Close position?', `Send a market order to close ${symbol} now.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => void closePosition(symbol) },
    ]);
  };

  const curveWidth = Math.max(200, width - spacing.lg * 2 - spacing.lg * 2);

  // See the matching comment in dashboard.tsx: an unfocused tab must render
  // nothing, since a transparent background alone doesn't hide it behind the
  // focused one.
  if (!isFocused) return null;

  return (
    <ScrollView style={shared.screen} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 56, paddingBottom: spacing.xxl }}>
      <View style={styles.tiles}>
        <StatTile label="Closed" value={String(stats.closedTrades)} sub="this session" />
        <StatTile label="Win rate" value={stats.closedTrades ? `${stats.winRate.toFixed(0)}%` : '—'} />
        <StatTile label="Net" value={stats.closedTrades ? fmtSigned(stats.netPnl) : '—'} valueColor={pnlColor(stats.netPnl)} />
      </View>

      <Text style={styles.sectionHeader}>Performance</Text>
      <View style={styles.performanceCard}>
        {snapshot.equityHistory.length >= 2 ? (
          <EquityCurve history={snapshot.equityHistory} width={curveWidth} height={110} />
        ) : (
          <View style={[styles.placeholderCard, { marginBottom: 0 }]}>
            <Text style={styles.placeholder}>
              The equity curve fills in once the engine has been running a little while.
            </Text>
          </View>
        )}
        <View style={styles.perfStatsRow}>
          <PerfStat
            label="Total return"
            value={snapshot.equityHistory.length >= 2 ? `${fmtSigned(stats.totalReturnPct)}%` : '—'}
            color={pnlColor(stats.totalReturnPct)}
          />
          <PerfStat
            label="Max drawdown"
            value={stats.maxDrawdownPct > 0 ? `-${stats.maxDrawdownPct.toFixed(1)}%` : '0.0%'}
            color={stats.maxDrawdownPct > 5 ? colors.down : colors.textMuted}
          />
          <PerfStat
            label="Profit factor"
            value={
              stats.closedTrades === 0
                ? '—'
                : stats.profitFactor === Infinity
                  ? '∞'
                  : stats.profitFactor.toFixed(2)
            }
          />
        </View>
        <View style={styles.perfStatsRow}>
          <PerfStat label="Avg win" value={stats.closedTrades ? fmtSigned(stats.avgWin) : '—'} color={colors.up} />
          <PerfStat label="Avg loss" value={stats.closedTrades ? fmtSigned(-stats.avgLoss) : '—'} color={colors.down} />
          <PerfStat label="Peak equity" value={stats.peakEquity > 0 ? `$${Math.round(stats.peakEquity).toLocaleString()}` : '—'} />
        </View>
      </View>

      <Text style={styles.sectionHeader}>Open positions</Text>
      {positions.length === 0 ? (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholder}>
            Nothing open. The engine opens a position when a symbol clears every rule and scores above your entry
            threshold.
          </Text>
        </View>
      ) : (
        positions.map((p) => (
          <PositionCard key={p.symbol} position={p} state={snapshot.symbols[p.symbol]} onClose={() => onClose(p.symbol)} />
        ))
      )}

      <Text style={styles.sectionHeader}>Trade history</Text>
      {closed.length === 0 ? (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholder}>Closed trades appear here with the reason each one was exited.</Text>
        </View>
      ) : (
        <View style={styles.historyCard}>
          {closed.slice(0, 60).map((t) => (
            <TradeRow key={t.id} trade={t} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function PerfStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.perfStat}>
      <Text style={styles.perfStatLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.perfStatValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function TradeRow({ trade }: { trade: TradeRecord }) {
  const pnl = trade.pnl ?? 0;
  return (
    <View style={styles.tradeRow}>
      <View style={styles.tradeLeft}>
        <View style={styles.tradeTitleRow}>
          <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
          <Chip label={trade.side === 'long' ? 'LONG' : 'SHORT'} tone={trade.side === 'long' ? 'up' : 'down'} size="sm" />
          <Chip label={(trade.exitReason ?? 'open').replace(/_/g, ' ')} tone="neutral" size="sm" />
        </View>
        <Text style={styles.tradeMeta}>
          {trade.qty} @ {fmtPrice(trade.entryPrice)} → {trade.exitPrice ? fmtPrice(trade.exitPrice) : '—'} ·{' '}
          {trade.closedAt ? formatRelative(trade.closedAt) : 'open'}
        </Text>
      </View>
      <View style={styles.tradeRight}>
        <Text style={[styles.tradePnl, { color: pnlColor(pnl) }]}>{fmtSigned(pnl)}</Text>
        <Text style={[styles.tradePct, { color: pnlColor(pnl) }]}>
          {trade.pnlPct !== null ? `${fmtSigned(trade.pnlPct * 100)}%` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionHeader: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  performanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    padding: spacing.lg,
  },
  perfStatsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  perfStat: {
    flex: 1,
  },
  perfStatLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  perfStatValue: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.bold,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  placeholderCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    padding: spacing.lg,
  },
  placeholder: {
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 19,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    overflow: 'hidden',
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardLine,
    gap: spacing.md,
  },
  tradeLeft: {
    flex: 1,
  },
  tradeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  tradeSymbol: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  tradeMeta: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  tradeRight: {
    alignItems: 'flex-end',
  },
  tradePnl: {
    fontSize: 14,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  tradePct: {
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
