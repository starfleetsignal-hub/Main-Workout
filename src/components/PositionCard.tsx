import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtPrice, fmtSigned } from '../engine/engine';
import type { OpenPosition, SymbolState } from '../engine/types';
import { colors, pnlColor } from '../theme/colors';
import { radius, spacing } from '../theme/layout';
import { Chip } from './Chip';

export function PositionCard({
  position,
  state,
  onClose,
}: {
  position: OpenPosition;
  state?: SymbolState;
  onClose: () => void;
}) {
  const price = state?.lastPrice || position.entryPrice;
  const dir = position.side === 'long' ? 1 : -1;
  const pnl = (price - position.entryPrice) * dir * position.qty;
  const pnlPct = (((price - position.entryPrice) * dir) / position.entryPrice) * 100;
  const heldMin = Math.max(0, Math.round((Date.now() - position.openedAt) / 60_000));

  // Where price sits between the stop and the target, 0..1.
  const span = Math.abs(position.takeProfitPrice - position.stopPrice) || 1;
  const progress = Math.min(1, Math.max(0, Math.abs(price - position.stopPrice) / span));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.symbol}>{position.symbol}</Text>
          <Chip label={position.side === 'long' ? 'LONG' : 'SHORT'} tone={position.side === 'long' ? 'up' : 'down'} size="sm" />
          {!position.managed ? <Chip label="ADOPTED" tone="warn" size="sm" /> : null}
        </View>
        <Text style={[styles.pnl, { color: pnlColor(pnl) }]}>{fmtSigned(pnl)}</Text>
      </View>

      <View style={styles.metaRow}>
        <Meta label="Qty" value={String(position.qty)} />
        <Meta label="Entry" value={fmtPrice(position.entryPrice)} />
        <Meta label="Last" value={fmtPrice(price)} />
        <Meta label="Return" value={`${fmtSigned(pnlPct)}%`} valueColor={pnlColor(pnl)} />
        <Meta label="Held" value={`${heldMin}m`} />
      </View>

      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: pnlColor(pnl) }]} />
        <View style={[styles.marker, { left: `${progress * 100}%` }]} />
      </View>
      <View style={styles.trackLabels}>
        <Text style={styles.trackLabel}>stop {fmtPrice(position.stopPrice)}</Text>
        <Text style={styles.trackLabel}>target {fmtPrice(position.takeProfitPrice)}</Text>
      </View>

      <Text style={styles.reason} numberOfLines={2}>
        {position.entryReason}
      </Text>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.closeText}>Close now</Text>
      </Pressable>
    </View>
  );
}

function Meta({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symbol: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  pnl: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  meta: {},
  metaLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 5,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    overflow: 'visible',
    justifyContent: 'center',
  },
  trackFill: {
    height: 5,
    borderRadius: radius.pill,
  },
  marker: {
    position: 'absolute',
    width: 2,
    height: 11,
    backgroundColor: colors.text,
    borderRadius: 1,
    marginLeft: -1,
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  trackLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  reason: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: spacing.md,
    lineHeight: 16,
  },
  closeButton: {
    marginTop: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.down,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  closeText: {
    color: colors.down,
    fontSize: 13,
    fontWeight: '700',
  },
});
