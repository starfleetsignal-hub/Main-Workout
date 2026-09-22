import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatRelative } from '../../src/components/ActivityRow';
import { Chip } from '../../src/components/Chip';
import { PositionCard } from '../../src/components/PositionCard';
import { StatTile } from '../../src/components/StatTile';
import { useEngine } from '../../src/context/EngineContext';
import { fmtPrice, fmtSigned } from '../../src/engine/engine';
import type { TradeRecord } from '../../src/engine/types';
import { colors, pnlColor } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { radius, shared, spacing } from '../../src/theme/layout';

export default function PositionsScreen() {
  const insets = useSafeAreaInsets();
  const { snapshot, closePosition } = useEngine();
  const positions = Object.values(snapshot.positions);
  const closed = snapshot.trades;

  const stats = useMemo(() => {
    const done = closed.filter((t) => t.pnl !== null);
    const wins = done.filter((t) => (t.pnl ?? 0) > 0);
    const gross = done.reduce((a, t) => a + (t.pnl ?? 0), 0);
    const best = done.reduce((a, t) => Math.max(a, t.pnl ?? 0), 0);
    const worst = done.reduce((a, t) => Math.min(a, t.pnl ?? 0), 0);
    return {
      count: done.length,
      winRate: done.length ? (wins.length / done.length) * 100 : 0,
      gross,
      best,
      worst,
    };
  }, [closed]);

  const onClose = (symbol: string) => {
    Alert.alert('Close position?', `Send a market order to close ${symbol} now.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => void closePosition(symbol) },
    ]);
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 56, paddingBottom: spacing.xxl }}>
      <View style={styles.tiles}>
        <StatTile label="Closed" value={String(stats.count)} sub="this session" />
        <StatTile label="Win rate" value={stats.count ? `${stats.winRate.toFixed(0)}%` : '—'} />
        <StatTile label="Net" value={stats.count ? fmtSigned(stats.gross) : '—'} valueColor={pnlColor(stats.gross)} />
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
