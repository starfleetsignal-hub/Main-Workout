import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function ProgressBar({ progress, color = colors.accent }: { progress: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
