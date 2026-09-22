import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ActivityEvent } from '../engine/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/layout';

const LEVEL_COLOR: Record<ActivityEvent['level'], string> = {
  info: colors.textFaint,
  signal: colors.gold,
  order: colors.up,
  warn: colors.warn,
  error: colors.down,
};

export function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: LEVEL_COLOR[event.level] }]} />
      <Text style={styles.time}>{formatTime(event.at)}</Text>
      {event.symbol ? <Text style={styles.symbol}>{event.symbol}</Text> : null}
      <Text style={styles.message} numberOfLines={3}>
        {event.message}
      </Text>
    </View>
  );
}

export function formatTime(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function formatRelative(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  time: {
    color: colors.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  symbol: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.bold,
    marginTop: 1,
  },
  message: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});
