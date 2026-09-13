import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PoseIcon } from '../../../src/components/PoseIcon';
import { useRoutines } from '../../../src/context/RoutineContext';
import { CATALOG } from '../../../src/data/muscles';
import { CatalogEntry } from '../../../src/data/types';
import { colors } from '../../../src/theme/colors';

type Filter = 'all' | 'strength' | 'stretch';

export default function AddExercisesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getRoutine, addItem } = useRoutines();
  const routine = getRoutine(id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((e) => {
      if (filter !== 'all' && e.kind !== filter) return false;
      if (!q) return true;
      return (e.name + ' ' + e.muscleName).toLowerCase().includes(q);
    });
  }, [query, filter]);

  const countInRoutine = (entryId: string) =>
    routine ? routine.items.filter((i) => i.entryId === entryId).length : 0;

  const handleAdd = (entry: CatalogEntry) => {
    if (!routine) return;
    addItem(routine.id, entry);
    setJustAdded(entry.entryId);
    setTimeout(() => setJustAdded((cur) => (cur === entry.entryId ? null : cur)), 900);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.controls}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises, stretches, or muscles..."
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <View style={styles.filterRow}>
          {(['all', 'strength', 'stretch'] as Filter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            >
              <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                {f === 'all' ? 'All' : f === 'strength' ? 'Strength' : 'Stretch'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(e) => e.entryId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const color = item.kind === 'strength' ? colors.strength : colors.stretch;
          const badgeBg = item.kind === 'strength' ? colors.strengthSoft : colors.stretchSoft;
          const count = countInRoutine(item.entryId);
          const added = justAdded === item.entryId;
          return (
            <View style={styles.row}>
              <View style={[styles.poseBadge, { backgroundColor: badgeBg }]}>
                <PoseIcon pose={item.pose} color={color} size={26} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.muscleName} · {item.level ?? item.type} · {item.detail}
                </Text>
              </View>
              <Pressable style={[styles.addBtn, added && styles.addBtnFlash]} onPress={() => handleAdd(item)}>
                <Text style={[styles.addBtnText, added && styles.addBtnTextFlash]}>
                  {added ? 'Added ✓' : count > 0 ? `+ Add (${count})` : '+ Add'}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No matches. Try a different search.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14.5,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  filterBtnText: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  filterBtnTextActive: {
    color: colors.accent,
  },
  list: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  poseBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnFlash: {
    backgroundColor: colors.stretch,
  },
  addBtnText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: 12,
  },
  addBtnTextFlash: {
    color: colors.bg,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
