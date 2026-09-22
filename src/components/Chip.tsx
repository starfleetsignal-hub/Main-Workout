import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius, spacing } from '../theme/layout';

export function Chip({
  label,
  tone = 'neutral',
  size = 'md',
}: {
  label: string;
  tone?: 'neutral' | 'up' | 'down' | 'warn' | 'accent' | 'gold';
  size?: 'sm' | 'md';
}) {
  const palette = {
    neutral: { bg: 'rgba(255,255,255,0.06)', fg: colors.textMuted },
    up: { bg: colors.upSoft, fg: colors.up },
    down: { bg: colors.downSoft, fg: colors.down },
    warn: { bg: colors.goldSoft, fg: colors.gold },
    accent: { bg: colors.cyanSoft, fg: colors.cyan },
    gold: { bg: colors.goldSoft, fg: colors.gold },
  }[tone];

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: palette.bg },
        size === 'sm' && { paddingHorizontal: 6, paddingVertical: 2 },
      ]}
    >
      <Text style={[styles.text, { color: palette.fg }, size === 'sm' && { fontSize: 10 }]}>{label}</Text>
    </View>
  );
}

export function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        styles.toggle,
        active && { backgroundColor: colors.goldSoft, borderColor: colors.goldLine },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.text, { color: active ? colors.gold : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  toggle: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0.4,
  },
});
