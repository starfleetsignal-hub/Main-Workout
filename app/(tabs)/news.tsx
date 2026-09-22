import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NewsRow } from '../../src/components/NewsRow';
import { ToggleChip } from '../../src/components/Chip';
import { useEngine } from '../../src/context/EngineContext';
import { colors } from '../../src/theme/colors';
import { shared, spacing } from '../../src/theme/layout';

type Filter = 'all' | 'watchlist' | 'positive' | 'negative';

export default function NewsScreen() {
  const { snapshot, parameters } = useEngine();
  const [filter, setFilter] = useState<Filter>('watchlist');

  const items = useMemo(() => {
    const watch = new Set(parameters.watchlist);
    return snapshot.news.filter((n) => {
      switch (filter) {
        case 'watchlist':
          return n.symbols.some((s) => watch.has(s));
        case 'positive':
          return n.sentiment > 0.15;
        case 'negative':
          return n.sentiment < -0.15;
        default:
          return true;
      }
    });
  }, [snapshot.news, parameters.watchlist, filter]);

  return (
    <View style={shared.screen}>
      <View style={styles.filters}>
        {(['watchlist', 'all', 'positive', 'negative'] as Filter[]).map((f) => (
          <ToggleChip key={f} label={label(f)} active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NewsRow item={item} />}
        ListEmptyComponent={
          <Text style={styles.placeholder}>
            {snapshot.streams.news === 'connected'
              ? 'No headlines match this filter yet. The stream is live and new items will appear here.'
              : 'Start the engine to stream headlines. Each one is scored for sentiment and fed into entry decisions.'}
          </Text>
        }
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

function label(f: Filter): string {
  switch (f) {
    case 'watchlist':
      return 'My symbols';
    case 'all':
      return 'Everything';
    case 'positive':
      return 'Positive';
    case 'negative':
      return 'Negative';
  }
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
  },
  placeholder: {
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
