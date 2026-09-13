import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { EntryCard } from '../../src/components/EntryCard';
import { SearchBar } from '../../src/components/SearchBar';
import { useCollection } from '../../src/context/CollectionContext';
import { colors } from '../../src/theme/colors';
import { resolveEntry } from '../../src/utils/display';

export default function WishlistScreen() {
  const { wishlist } = useCollection();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return wishlist
      .map((item) => ({ item, info: resolveEntry(item) }))
      .filter(({ info }) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return info.name.toLowerCase().includes(q) || info.number.toLowerCase().includes(q);
      });
  }, [wishlist, query]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="WISH LIST" />
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search wish list..." />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="❤️"
            title="Your wish list is empty"
            message="Browse the Full Checklist in Collection and tap + on anything you're hunting for."
          />
        ) : (
          <View style={styles.grid}>
            {filtered.map(({ item, info }) => (
              <EntryCard
                key={item.id}
                number={info.number}
                name={info.name}
                category={info.category}
                year={info.year}
                photoUri={item.photoUri}
                color={item.color}
                condition={item.condition}
                hasBox={item.hasBox}
                status="wishlist"
                onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
