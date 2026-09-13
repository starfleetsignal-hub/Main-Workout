import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MuscleCard } from '../../src/components/MuscleCard';
import { MUSCLES } from '../../src/data/muscles';
import { colors } from '../../src/theme/colors';

export default function SearchScreen() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MUSCLES;
    return MUSCLES.filter((m) => {
      const haystack = [m.name, ...m.aliases, m.group, m.short].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.searchBarWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a muscle (e.g. glutes, biceps...)"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <MuscleCard muscle={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No muscles match "{query}". Try a different name.</Text>
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
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
