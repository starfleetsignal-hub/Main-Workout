import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { EntryCard } from '../../src/components/EntryCard';
import { FilterChip } from '../../src/components/FilterChip';
import { FilterSheet } from '../../src/components/FilterSheet';
import { ProgressBar } from '../../src/components/ProgressBar';
import { SearchBar } from '../../src/components/SearchBar';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { CATALOG, CATALOG_YEAR_RANGE, SERIES_LIST } from '../../src/data/catalog';
import { CONDITIONS } from '../../src/data/types';
import { useCollection } from '../../src/context/CollectionContext';
import { colors } from '../../src/theme/colors';
import { resolveEntry } from '../../src/utils/display';

type Mode = 'My Garage' | 'Full Checklist';
type FilterKind = 'series' | 'year' | 'condition' | null;

const YEAR_BUCKETS = (() => {
  const [min, max] = CATALOG_YEAR_RANGE;
  const buckets: string[] = [];
  for (let start = Math.floor(min / 10) * 10; start <= max; start += 10) {
    buckets.push(`${start}s`);
  }
  return buckets;
})();

function yearInBucket(year: number, bucket: string) {
  const decade = parseInt(bucket, 10);
  return year >= decade && year < decade + 10;
}

export default function CollectionScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { owned, addItem, statusForModel } = useCollection();
  const [mode, setMode] = useState<Mode>('My Garage');
  const [query, setQuery] = useState('');
  const [seriesFilter, setSeriesFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [conditionFilter, setConditionFilter] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<FilterKind>(null);

  useEffect(() => {
    if (params.q) setQuery(params.q);
  }, [params.q]);

  const garageItems = useMemo(() => {
    return owned
      .map((item) => ({ item, info: resolveEntry(item) }))
      .filter(({ item, info }) => {
        if (query && !info.name.toLowerCase().includes(query.toLowerCase()) && !info.number.toLowerCase().includes(query.toLowerCase())) {
          return false;
        }
        if (seriesFilter && info.series !== seriesFilter) return false;
        if (yearFilter && (!info.year || !yearInBucket(info.year, yearFilter))) return false;
        if (conditionFilter && item.condition !== conditionFilter) return false;
        return true;
      });
  }, [owned, query, seriesFilter, yearFilter, conditionFilter]);

  const checklistItems = useMemo(() => {
    return CATALOG.filter((model) => {
      if (query && !model.name.toLowerCase().includes(query.toLowerCase()) && !model.number.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      if (seriesFilter && model.series !== seriesFilter) return false;
      if (yearFilter && !yearInBucket(model.year, yearFilter)) return false;
      return true;
    });
  }, [query, seriesFilter, yearFilter]);

  const checklistProgress = useMemo(() => {
    if (mode !== 'Full Checklist') return null;
    const total = checklistItems.length;
    const done = checklistItems.filter((m) => statusForModel(m.id) === 'owned').length;
    return { total, done, pct: total ? done / total : 0 };
  }, [mode, checklistItems, statusForModel]);

  const quickAdd = (catalogId: string) => {
    const model = CATALOG.find((m) => m.id === catalogId);
    if (!model) return;
    addItem({
      catalogId: model.id,
      status: 'owned',
      name: model.name,
      number: model.number,
      series: model.series,
      year: model.year,
      category: model.category,
      color: model.colors[0] ?? 'Unknown',
      condition: 'Good',
      hasBox: false,
      quantity: 1,
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="MY COLLECTION" />
      <View style={styles.controlsWrap}>
        <SegmentedControl options={['My Garage', 'Full Checklist']} value={mode} onChange={(v) => setMode(v as Mode)} />
        <View style={{ height: 12 }} />
        <SearchBar value={query} onChangeText={setQuery} />
        <View style={{ height: 10 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip label="Series" value={seriesFilter} active={!!seriesFilter} onPress={() => setOpenFilter('series')} />
          <FilterChip label="Year" value={yearFilter} active={!!yearFilter} onPress={() => setOpenFilter('year')} />
          {mode === 'My Garage' && (
            <FilterChip
              label="Condition"
              value={conditionFilter}
              active={!!conditionFilter}
              onPress={() => setOpenFilter('condition')}
            />
          )}
        </ScrollView>
        {checklistProgress && (
          <View style={{ marginTop: 12 }}>
            <ProgressBar progress={checklistProgress.pct} color={colors.success} />
            <Text style={styles.progressCaption}>
              {checklistProgress.done} / {checklistProgress.total} owned in this view
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {mode === 'My Garage' ? (
          garageItems.length === 0 ? (
            <EmptyState icon="🧰" title="No matches" message="Try clearing your search or filters." />
          ) : (
            <View style={styles.grid}>
              {garageItems.map(({ item, info }) => (
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
                  status={item.status}
                  onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                />
              ))}
            </View>
          )
        ) : checklistItems.length === 0 ? (
          <EmptyState icon="📋" title="No matches" message="Try clearing your search or filters." />
        ) : (
          <View style={styles.grid}>
            {checklistItems.map((model) => {
              const status = statusForModel(model.id) ?? 'none';
              return (
                <EntryCard
                  key={model.id}
                  number={model.number}
                  name={model.name}
                  category={model.category}
                  year={model.year}
                  status={status}
                  onPress={() => router.push({ pathname: '/model/[id]', params: { id: model.id } })}
                  onQuickAdd={status === 'none' ? () => quickAdd(model.id) : undefined}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <FilterSheet
        visible={openFilter === 'series'}
        title="Filter by Series"
        options={SERIES_LIST}
        selected={seriesFilter}
        onSelect={setSeriesFilter}
        onClose={() => setOpenFilter(null)}
      />
      <FilterSheet
        visible={openFilter === 'year'}
        title="Filter by Decade"
        options={YEAR_BUCKETS}
        selected={yearFilter}
        onSelect={setYearFilter}
        onClose={() => setOpenFilter(null)}
      />
      <FilterSheet
        visible={openFilter === 'condition'}
        title="Filter by Condition"
        options={CONDITIONS}
        selected={conditionFilter}
        onSelect={setConditionFilter}
        onClose={() => setOpenFilter(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  controlsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  progressCaption: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 6,
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
