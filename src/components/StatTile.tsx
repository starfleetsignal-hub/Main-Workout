import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius, spacing } from '../theme/layout';

export function StatTile({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 96,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  label: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: {
    color: colors.text,
    fontSize: 19,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
});
