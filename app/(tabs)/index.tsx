import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MuscleCard } from '../../src/components/MuscleCard';
import { MUSCLE_GROUPS, getMuscleById, getMusclesByGroup } from '../../src/data/muscles';
import { colors, groupColors } from '../../src/theme/colors';

type Row = { type: 'header'; group: string } | { type: 'muscle'; id: string };

export default function HomeScreen() {
  const rows: Row[] = [];
  for (const group of MUSCLE_GROUPS) {
    rows.push({ type: 'header', group });
    for (const m of getMusclesByGroup(group)) {
      rows.push({ type: 'muscle', id: m.id });
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(item, i) => (item.type === 'header' ? `h-${item.group}` : item.id) + i}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.title}>MuscleGuide</Text>
            <Text style={styles.subtitle}>Strength and stretching for every major muscle, grounded in mainstream exercise-science guidance.</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={styles.groupHeader}>
                <View style={[styles.dot, { backgroundColor: groupColors[item.group] }]} />
                <Text style={styles.groupTitle}>{item.group}</Text>
              </View>
            );
          }
          const muscle = getMuscleById(item.id)!;
          return <MuscleCard muscle={muscle} />;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  intro: {
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
