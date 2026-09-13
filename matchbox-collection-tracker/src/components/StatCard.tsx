import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 140,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.text,
  },
});
