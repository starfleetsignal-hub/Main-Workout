import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export function FilterChip({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value?: string | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {value ?? label}
      </Text>
      <Text style={[styles.caret, active && styles.textActive]}>⌄</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 8,
    maxWidth: 160,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 4,
  },
  textActive: {
    color: colors.accent,
  },
  caret: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
