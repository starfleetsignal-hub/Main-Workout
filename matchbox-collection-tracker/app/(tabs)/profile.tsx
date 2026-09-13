import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { SectionHeader } from '../../src/components/SectionHeader';
import { StatCard } from '../../src/components/StatCard';
import { CATALOG, SERIES_LIST, countBySeries } from '../../src/data/catalog';
import { useCollection } from '../../src/context/CollectionContext';
import { usePreferences } from '../../src/context/PreferencesContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

export default function ProfileScreen() {
  const { owned, wishlist, items } = useCollection();
  const { focusSeries, isFocused, toggleFocusSeries, clearFocusSeries } = usePreferences();

  const totalSpent = owned.reduce((sum, it) => sum + (it.purchasePrice ?? 0), 0);

  const resetAll = () => {
    Alert.alert(
      'Reset all data?',
      'This clears every collection entry, wish list item, and personalization setting on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeMany(['matchboxcollector.items.v1', 'matchboxcollector.prefs.v1']);
            Alert.alert('Done', 'Restart the app to see a clean slate.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="PROFILE" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard label="Owned" value={String(owned.length)} accent={colors.success} />
          <StatCard label="Wish List" value={String(wishlist.length)} accent={colors.wishlist} />
        </View>
        <View style={[styles.statsRow, { marginBottom: 24 }]}>
          <StatCard label="Total Entries" value={String(items.length)} />
          <StatCard label="Est. Spent" value={`$${totalSpent.toFixed(0)}`} accent={colors.accent} />
        </View>

        <SectionHeader title="Personalize what you collect" />
        <Text style={styles.helper}>
          Pick the series you actively collect. Your Series Tracking % on Home only counts these — leave
          none selected to track everything.
        </Text>
        <View style={styles.seriesList}>
          {SERIES_LIST.map((series) => {
            const active = isFocused(series);
            return (
              <Pressable
                key={series}
                style={[styles.seriesRow, active && styles.seriesRowActive]}
                onPress={() => toggleFocusSeries(series)}
              >
                <View style={[styles.checkbox, active && styles.checkboxActive]}>
                  {active && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.seriesName}>{series}</Text>
                <Text style={styles.seriesCount}>{countBySeries(series)} models</Text>
              </Pressable>
            );
          })}
        </View>

        {focusSeries.length > 0 && (
          <Pressable onPress={clearFocusSeries} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear focus series ({focusSeries.length} selected)</Text>
          </Pressable>
        )}

        <SectionHeader title="About this checklist" />
        <Text style={styles.helper}>
          The master checklist ({CATALOG.length} models) is a curated reference spanning Matchbox eras from
          1953 to today — it is not an official Mattel catalog, and model numbers are a simplified in-app
          scheme for browsing. Use "Add" to log any real item, whether it's on the checklist or a custom
          piece of your own.
        </Text>

        <SectionHeader title="Data" />
        <Pressable style={styles.dangerBtn} onPress={resetAll}>
          <Text style={styles.dangerBtnText}>Reset all data</Text>
        </Pressable>
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
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  helper: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 14,
  },
  seriesList: {
    marginBottom: 8,
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  seriesRowActive: {
    borderColor: colors.accent,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxMark: {
    color: colors.onAccent,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  seriesName: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
  },
  seriesCount: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textFaint,
  },
  clearBtn: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  clearBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.accent,
  },
  dangerBtn: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.danger,
  },
});
