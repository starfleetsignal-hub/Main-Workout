import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { EntryCard } from '../../src/components/EntryCard';
import { ProgressBar } from '../../src/components/ProgressBar';
import { SearchBar } from '../../src/components/SearchBar';
import { StatCard } from '../../src/components/StatCard';
import { CATALOG } from '../../src/data/catalog';
import { useCollection } from '../../src/context/CollectionContext';
import { usePreferences } from '../../src/context/PreferencesContext';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { resolveEntry } from '../../src/utils/display';
import { seriesTracking } from '../../src/utils/stats';

export default function HomeScreen() {
  const { owned, wishlist } = useCollection();
  const { focusSeries } = usePreferences();
  const [query, setQuery] = useState('');

  const tracking = useMemo(() => seriesTracking(owned, focusSeries), [owned, focusSeries]);

  const recentOwned = useMemo(
    () => [...owned].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 6),
    [owned]
  );

  const submitSearch = () => {
    router.push({ pathname: '/(tabs)/collection', params: query ? { q: query } : {} });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="MY MATCHBOX COLLECTION" rightIcon="⚙️" onRightPress={() => router.push('/(tabs)/profile')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 16 }}>
          <SearchBar value={query} onChangeText={setQuery} />
        </View>

        <View style={styles.dashboard}>
          <Text style={styles.dashboardTitle}>YOUR COLLECTION DASHBOARD</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Total Matchboxes" value={String(CATALOG.length)} />
            <StatCard label="Cataloged" value={String(owned.length)} accent={colors.success} />
          </View>
          <View style={styles.statsGrid}>
            <StatCard label="Wish List" value={String(wishlist.length)} accent={colors.wishlist} />
            <StatCard label="Series Tracking" value={`${tracking.pct}% Complete`} accent={colors.accent} />
          </View>
          <View style={{ marginTop: 12 }}>
            <ProgressBar progress={tracking.pct / 100} />
            <Text style={styles.trackingCaption}>
              {tracking.completed} / {tracking.total} models
              {focusSeries.length ? ' in your focus series' : ' overall'} — tune this in Profile
            </Text>
          </View>
        </View>

        <View style={styles.garageHeaderRow}>
          <Text style={styles.garageTitle}>MY GARAGE ({owned.length} Items)</Text>
          <Pressable onPress={() => router.push('/(tabs)/collection')}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {recentOwned.length === 0 ? (
          <EmptyState
            icon="🧰"
            title="Your garage is empty"
            message="Tap the + tab to log your first Matchbox, or browse the full checklist to get started."
          />
        ) : (
          <View style={styles.grid}>
            {recentOwned.map((item) => {
              const info = resolveEntry(item);
              return (
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
                  status="owned"
                  onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                />
              );
            })}
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  dashboard: {
    backgroundColor: colors.header,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  dashboardTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  trackingCaption: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
  },
  garageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  garageTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  seeAll: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
