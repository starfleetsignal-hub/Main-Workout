import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoutines } from '../../src/context/RoutineContext';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

function estimateMinutes(itemCount: { strength: number; stretch: number }) {
  return Math.round(itemCount.strength * 4 + itemCount.stretch * 1.5);
}

export default function BuilderScreen() {
  const router = useRouter();
  const { routines, loaded, createRoutine } = useRoutines();
  const [name, setName] = useState('');

  const handleCreate = () => {
    const id = createRoutine(name || 'My Routine');
    setName('');
    router.push({ pathname: '/routine/[id]', params: { id } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={routines}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Routine Builder</Text>
            <Text style={styles.subtitle}>Pick exercises and stretches from any muscle and build your own workout.</Text>
            <View style={styles.newRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name your routine (e.g. Leg Day)"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
              <Pressable style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>+ New</Text>
              </Pressable>
            </View>
            {routines.length > 0 && <Text style={styles.sectionLabel}>Your routines</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const strength = item.items.filter((i) => i.kind === 'strength').length;
          const stretch = item.items.filter((i) => i.kind === 'stretch').length;
          const mins = estimateMinutes({ strength, stretch });
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: item.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.items.length === 0
                    ? 'No exercises yet'
                    : `${strength} strength · ${stretch} stretch · ~${mins} min`}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🛠️</Text>
              <Text style={styles.emptyTitle}>No routines yet</Text>
              <Text style={styles.emptyText}>Name a routine above and start adding exercises and stretches to it.</Text>
            </View>
          ) : null
        }
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
    flexGrow: 1,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontFamily: fonts.extrabold,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 19,
  },
  newRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
  },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  createBtnText: {
    color: colors.onAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12.5,
    marginTop: 4,
  },
  chevron: {
    color: colors.textFaint,
    fontSize: 22,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
