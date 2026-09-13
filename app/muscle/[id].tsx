import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseCard } from '../../src/components/ExerciseCard';
import { StretchCard } from '../../src/components/StretchCard';
import { useFavorites } from '../../src/context/FavoritesContext';
import { getMuscleById } from '../../src/data/muscles';
import { colors, groupColors } from '../../src/theme/colors';

type TabKey = 'strength' | 'stretch' | 'anatomy';

export default function MuscleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const muscle = getMuscleById(id);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [tab, setTab] = useState<TabKey>('strength');

  if (!muscle) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.notFound}>Muscle not found.</Text>
      </SafeAreaView>
    );
  }

  const fav = isFavorite(muscle.id);
  const groupColor = groupColors[muscle.group] ?? colors.accent;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: muscle.name,
          headerRight: () => (
            <Pressable hitSlop={10} onPress={() => toggleFavorite(muscle.id)}>
              <Text style={[styles.headerStar, fav && styles.headerStarActive]}>{fav ? '★' : '☆'}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { borderColor: groupColor + '55' }]}>
          <Text style={[styles.group, { color: groupColor }]}>{muscle.group}</Text>
          <Text style={styles.name}>{muscle.name}</Text>
          {muscle.aliases.length > 0 && (
            <Text style={styles.aliases}>{muscle.aliases.join(' • ')}</Text>
          )}
          <Text style={styles.short}>{muscle.short}</Text>
        </View>

        <View style={styles.tabBar}>
          <TabButton label="Strength" active={tab === 'strength'} onPress={() => setTab('strength')} color={colors.strength} />
          <TabButton label="Stretch" active={tab === 'stretch'} onPress={() => setTab('stretch')} color={colors.stretch} />
          <TabButton label="Anatomy" active={tab === 'anatomy'} onPress={() => setTab('anatomy')} color={colors.accent} />
        </View>

        {tab === 'strength' && (
          <View>
            {muscle.strength.map((ex, i) => (
              <ExerciseCard key={ex.name} exercise={ex} index={i} />
            ))}
          </View>
        )}

        {tab === 'stretch' && (
          <View>
            {muscle.stretches.map((st, i) => (
              <StretchCard key={st.name} stretch={st} index={i} />
            ))}
          </View>
        )}

        {tab === 'anatomy' && (
          <View style={styles.anatomyCard}>
            <AnatomyRow label="Function" value={muscle.anatomy.function} />
            <AnatomyRow label="Origin" value={muscle.anatomy.origin} />
            <AnatomyRow label="Insertion" value={muscle.anatomy.insertion} />
            <AnatomyRow label="Joints involved" value={muscle.anatomy.joints} />
          </View>
        )}

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Safety notes</Text>
          {muscle.safety.map((s, i) => (
            <View style={styles.safetyRow} key={i}>
              <Text style={styles.safetyBullet}>•</Text>
              <Text style={styles.safetyText}>{s}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function TabButton({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, active && { backgroundColor: color + '22', borderColor: color }]}
    >
      <Text style={[styles.tabButtonText, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

function AnatomyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.anatomyRow}>
      <Text style={styles.anatomyLabel}>{label}</Text>
      <Text style={styles.anatomyValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  notFound: {
    color: colors.text,
    textAlign: 'center',
    marginTop: 40,
  },
  hero: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  group: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  name: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  aliases: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 4,
  },
  short: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  tabButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  anatomyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  anatomyRow: {
    marginBottom: 14,
  },
  anatomyLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  anatomyValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  safetyCard: {
    backgroundColor: colors.strengthSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.strength + '55',
    padding: 16,
    marginTop: 8,
  },
  safetyTitle: {
    color: colors.strength,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  safetyRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  safetyBullet: {
    color: colors.strength,
    width: 14,
    fontSize: 13,
  },
  safetyText: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  headerStar: {
    fontSize: 22,
    color: colors.textFaint,
  },
  headerStarActive: {
    color: colors.favorite,
  },
});
