import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export function EmptyState({ icon = '🚗', title, message }: { icon?: string; title: string; message?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
    opacity: 0.7,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
