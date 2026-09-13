import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { PoseIcon } from './PoseIcon';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Exercise } from '../data/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LEVEL_COLOR: Record<string, string> = {
  Beginner: colors.stretch,
  Intermediate: '#DE9F2E',
  Advanced: colors.danger,
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
        <View style={styles.poseBadge}>
          <PoseIcon pose={exercise.pose} color={colors.strength} size={30} />
        </View>
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  poseBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.strengthSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  setsReps: {
    color: colors.strength,
    fontSize: 13,
    fontFamily: fonts.semibold,
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
    fontFamily: fonts.bold,
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
