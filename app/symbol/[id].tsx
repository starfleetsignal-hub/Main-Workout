import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '../../src/components/Chip';
import { NewsRow } from '../../src/components/NewsRow';
import { Sparkline } from '../../src/components/Sparkline';
import { StatTile } from '../../src/components/StatTile';
import { useEngine } from '../../src/context/EngineContext';
import { fmtPrice, fmtSigned } from '../../src/engine/engine';
import { colors, pnlColor } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { radius, shared, spacing } from '../../src/theme/layout';

export default function SymbolScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const symbol = decodeURIComponent(String(id ?? ''));
  const navigation = useNavigation();
  const { snapshot, parameters } = useEngine();

  const state = snapshot.symbols[symbol];
  const signal = snapshot.signals[symbol];
  const position = snapshot.positions[symbol];

  useEffect(() => {
    navigation.setOptions({ title: symbol });
  }, [navigation, symbol]);

  const closes = useMemo(() => (state?.bars ?? []).slice(-120).map((b) => b.c), [state?.bars]);
  const changePct = closes.length > 1 && state?.lastPrice ? ((state.lastPrice - closes[0]) / closes[0]) * 100 : 0;

  if (!state) {
    return (
      <View style={[shared.screen, styles.center, { paddingTop: insets.top + 56 }]}>
        <Text style={styles.placeholder}>{symbol} is not being watched.</Text>
      </View>
    );
  }

  const ind = state.indicators;

  return (
    <ScrollView style={shared.screen} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 56, paddingBottom: spacing.xxl }}>
      <View style={styles.priceRow}>
        <View>
          <Text style={styles.price}>{state.lastPrice ? fmtPrice(state.lastPrice) : '—'}</Text>
          <Text style={[styles.change, { color: pnlColor(changePct) }]}>
            {closes.length > 1 ? `${fmtSigned(changePct)}% over the last ${closes.length} bars` : 'warming up'}
          </Text>
        </View>
        <Sparkline values={closes} width={140} height={44} />
      </View>

      {position ? (
        <View style={styles.positionBanner}>
          <Chip label={position.side === 'long' ? 'LONG' : 'SHORT'} tone={position.side === 'long' ? 'up' : 'down'} size="sm" />
          <Text style={styles.positionText}>
            {position.qty} @ {fmtPrice(position.entryPrice)} · stop {fmtPrice(position.stopPrice)} · target{' '}
            {fmtPrice(position.takeProfitPrice)}
          </Text>
        </View>
      ) : null}

      <View style={styles.tiles}>
        <StatTile label="RSI 14" value={ind ? ind.rsi14.toFixed(0) : '—'} />
        <StatTile label="VWAP" value={ind ? fmtPrice(ind.vwap) : '—'} />
        <StatTile label="ATR 14" value={ind ? fmtPrice(ind.atr14) : '—'} />
      </View>
      <View style={styles.tiles}>
        <StatTile label="EMA 9" value={ind ? fmtPrice(ind.ema9) : '—'} />
        <StatTile label="EMA 21" value={ind ? fmtPrice(ind.ema21) : '—'} />
        <StatTile
          label="Volume"
          value={ind && ind.avgVolume20 > 0 ? `${(ind.lastVolume / ind.avgVolume20).toFixed(2)}x` : '—'}
          sub={`need ${parameters.minVolumeMultiple}x`}
        />
      </View>

      <Text style={styles.sectionHeader}>Signal breakdown</Text>
      <View style={styles.card}>
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreValue}>{signal ? signal.score : '—'}</Text>
          <Text style={styles.scoreOutOf}>/ 100 · need {parameters.minSignalScore}</Text>
          {signal?.side ? (
            <Chip label={`WOULD GO ${signal.side.toUpperCase()}`} tone="up" size="sm" />
          ) : (
            <Chip label="NO ENTRY" tone="neutral" size="sm" />
          )}
        </View>
        {signal?.components.length ? (
          signal.components.map((c) => (
            <View key={c.name} style={styles.componentRow}>
              <View style={styles.componentText}>
                <Text style={styles.componentName}>{c.name}</Text>
                <Text style={styles.componentDetail}>{c.detail}</Text>
              </View>
              <View style={styles.componentBarWrap}>
                <View style={styles.componentBar}>
                  <View
                    style={[
                      styles.componentFill,
                      {
                        width: `${Math.max(0, Math.min(100, (c.points / c.max) * 100))}%`,
                        backgroundColor: c.points > 0 ? colors.gold : colors.cardLine,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.componentPoints}>
                  {Math.max(0, Math.min(c.max, c.points))}/{c.max}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.placeholder}>Not enough data yet.</Text>
        )}
      </View>

      {signal?.blockers.length ? (
        <>
          <Text style={styles.sectionHeader}>Blocking entry</Text>
          <View style={styles.card}>
            {signal.blockers.map((b) => (
              <View key={b} style={styles.blockerRow}>
                <Text style={styles.blockerDot}>✕</Text>
                <Text style={styles.blockerText}>{b}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionHeader}>
        News · sentiment {state.newsScore >= 0 ? '+' : ''}
        {state.newsScore.toFixed(2)}
      </Text>
      <View style={styles.card}>
        {state.news.length === 0 ? (
          <Text style={styles.placeholder}>No recent headlines for {symbol}.</Text>
        ) : (
          state.news.slice(0, 12).map((n) => <NewsRow key={n.id} item={n} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  price: {
    color: colors.text,
    fontSize: 32,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  change: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    marginTop: 4,
  },
  positionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  positionText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    overflow: 'hidden',
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardLine,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 26,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  scoreOutOf: {
    color: colors.textFaint,
    fontSize: 12,
    flex: 1,
  },
  componentRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardLine,
  },
  componentText: {
    marginBottom: 6,
  },
  componentName: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  componentDetail: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  componentBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  componentBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.cardRaised,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  componentFill: {
    height: 4,
    borderRadius: radius.pill,
  },
  componentPoints: {
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
    minWidth: 38,
    textAlign: 'right',
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardLine,
  },
  blockerDot: {
    color: colors.down,
    fontSize: 11,
    marginTop: 2,
  },
  blockerText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  placeholder: {
    color: colors.textFaint,
    fontSize: 13,
    padding: spacing.lg,
    lineHeight: 19,
  },
});
