import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NewsItem } from '../engine/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius, spacing } from '../theme/layout';
import { formatRelative } from './ActivityRow';

export function NewsRow({ item }: { item: NewsItem }) {
  const tone = item.sentiment > 0.15 ? colors.up : item.sentiment < -0.15 ? colors.down : colors.textFaint;

  return (
    <Pressable
      onPress={() => {
        if (item.url) void Linking.openURL(item.url).catch(() => {});
      }}
      disabled={!item.url}
      accessibilityRole={item.url ? 'link' : 'text'}
      style={({ pressed }) => [styles.row, pressed && item.url ? { backgroundColor: colors.cardRaised } : null]}
    >
      <View style={[styles.gauge, { backgroundColor: tone }]} />
      <View style={styles.body}>
        <Text style={styles.headline} numberOfLines={3}>
          {item.headline}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.score, { color: tone }]}>
            {item.sentiment >= 0 ? '+' : ''}
            {item.sentiment.toFixed(2)}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.symbols.slice(0, 4).join(' · ') || 'market'}
          </Text>
          <Text style={styles.meta}>{formatRelative(item.createdAt)}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.source}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardLine,
  },
  gauge: {
    width: 3,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  headline: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.semibold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 6,
  },
  score: {
    fontSize: 11,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    color: colors.textFaint,
    fontSize: 11,
  },
});
