import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdBanner } from '../../src/components/AdBanner';
import { MuscleCard } from '../../src/components/MuscleCard';
import { useFavorites } from '../../src/context/FavoritesContext';
import { getMuscleById } from '../../src/data/muscles';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

export default function FavoritesScreen() {
  const { favorites, loaded } = useFavorites();
  const muscles = favorites.map((id) => getMuscleById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getMuscleById>>[];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={muscles}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.title}>Favorites</Text>}
        renderItem={({ item }) => <MuscleCard muscle={item} />}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>⭐</Text>
              <Text style={styles.emptyTitle}>No favorites yet</Text>
              <Text style={styles.emptyText}>Tap the star on any muscle to save it here for quick access.</Text>
            </View>
          ) : null
        }
      />
      <AdBanner />
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
    marginBottom: 16,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
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
