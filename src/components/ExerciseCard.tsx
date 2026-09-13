import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { colors } from '../theme/colors';
import { Exercise } from '../data/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LEVEL_COLOR: Record<string, string> = {
  Beginner: '#34D399',
  Intermediate: '#FBBF24',
  Advanced: '#F87171',
};

export function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const [open, setOpen] = useState(index === 0);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={toggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{exercise.name}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: (LEVEL_COLOR[exercise.level] ?? colors.accent) + '26' }]}>
              <Text style={[styles.badgeText, { color: LEVEL_COLOR[exercise.level] ?? colors.accent }]}>{exercise.level}</Text>
            </View>
            <Text style={styles.meta}>{exercise.equipment}</Text>
          </View>
          <Text style={styles.setsReps}>{exercise.setsReps}</Text>
        </View>
        <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open && (
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>How to do it</Text>
          {exercise.instructions.map((step, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.bullet}>{i + 1}.</Text>
              <Text style={styles.rowText}>{step}</Text>
            </View>
          ))}
          <Text style={styles.sectionLabel}>Coaching cues</Text>
          {exercise.cues.map((cue, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.rowText}>{cue}</Text>
            </View>
          ))}
          <Text style={styles.sectionLabel}>Avoid</Text>
          {exercise.mistakes.map((m, i) => (
            <View style={styles.row} key={i}>
              <Text style={[styles.bulletDot, { color: colors.danger }]}>•</Text>
              <Text style={styles.rowText}>{m}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  setsReps: {
    color: colors.strength,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '400',
    paddingLeft: 8,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  bullet: {
    color: colors.textMuted,
    width: 20,
    fontSize: 13,
  },
  bulletDot: {
    color: colors.accent,
    width: 14,
    fontSize: 13,
  },
  rowText: {
    color: colors.text,
    fontSize: 13.5,
    flex: 1,
    lineHeight: 19,
  },
});
