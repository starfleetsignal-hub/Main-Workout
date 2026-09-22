import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtPrice } from '../engine/engine';
import type { OpenPosition, Signal, SymbolState } from '../engine/types';
import { colors, pnlColor } from '../theme/colors';
import { radius, spacing } from '../theme/layout';
import { Chip } from './Chip';
import { Sparkline } from './Sparkline';

export function SymbolRow({
  state,
  signal,
  position,
  onPress,
}: {
  state: SymbolState;
  signal?: Signal;
  position?: OpenPosition;
  onPress?: () => void;
}) {
  const closes = state.bars.slice(-40).map((b) => b.c);
  const first = closes[0];
  const changePct = first && state.lastPrice ? ((state.lastPrice - first) / first) * 100 : 0;
  const score = signal?.score ?? 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgElevated }]}
    >
      <View style={styles.left}>
        <View style={styles.symbolLine}>
          <Text style={styles.symbol}>{state.symbol}</Text>
          {position ? <Chip label={position.side === 'long' ? 'LONG' : 'SHORT'} tone={position.side === 'long' ? 'up' : 'down'} size="sm" /> : null}
          {state.assetClass === 'crypto' ? <Chip label="24/7" tone="neutral" size="sm" /> : null}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {state.indicators
            ? `RSI ${state.indicators.rsi14.toFixed(0)} · VWAP ${fmtPrice(state.indicators.vwap)}`
            : 'warming up…'}
          {state.news.length ? ` · news ${state.newsScore >= 0 ? '+' : ''}${state.newsScore.toFixed(2)}` : ''}
        </Text>
      </View>

      <Sparkline values={closes} />

      <View style={styles.right}>
        <Text style={styles.price}>{state.lastPrice ? fmtPrice(state.lastPrice) : '—'}</Text>
        <Text style={[styles.change, { color: pnlColor(changePct) }]}>
          {closes.length > 1 ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
        </Text>
      </View>

      <View style={styles.scoreWrap}>
        <View style={[styles.scoreBar, { backgroundColor: scoreColor(score) + '33' }]}>
          <View style={[styles.scoreFill, { height: `${Math.min(100, score)}%`, backgroundColor: scoreColor(score) }]} />
        </View>
        <Text style={[styles.scoreText, { color: scoreColor(score) }]}>{signal ? score : '—'}</Text>
      </View>
    </Pressable>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return colors.up;
  if (score >= 50) return colors.warn;
  return colors.textFaint;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  symbolLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symbol: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sub: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 74,
  },
  price: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  change: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  scoreWrap: {
    alignItems: 'center',
    width: 26,
  },
  scoreBar: {
    width: 5,
    height: 30,
    borderRadius: radius.pill,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  scoreFill: {
    width: '100%',
    borderRadius: radius.pill,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
});
