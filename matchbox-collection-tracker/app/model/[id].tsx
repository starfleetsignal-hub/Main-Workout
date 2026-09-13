import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EntryCard } from '../../src/components/EntryCard';
import { ModelThumb } from '../../src/components/ModelThumb';
import { getModelById } from '../../src/data/catalog';
import { useCollection } from '../../src/context/CollectionContext';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

export default function ModelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const model = getModelById(id);
  const { itemsForModel } = useCollection();

  if (!model) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.notFound}>Model not found.</Text>
      </SafeAreaView>
    );
  }

  const linked = itemsForModel(model.id);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ title: model.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <ModelThumb category={model.category} size={110} />
          <View style={styles.heroInfo}>
            <Text style={styles.number}>#{model.number}</Text>
            <Text style={styles.name}>{model.name}</Text>
            <Text style={styles.meta}>
              {model.series} · {model.year}
            </Text>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{model.category}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Common colors</Text>
        <View style={styles.chipRow}>
          {model.colors.map((c) => (
            <View key={c} style={styles.colorChip}>
              <Text style={styles.colorChipText}>{c}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={() =>
              router.push({ pathname: '/add', params: { catalogId: model.id, status: 'owned' } })
            }
          >
            <Text style={styles.actionBtnText}>+ Add to Garage</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.wishlist }]}
            onPress={() =>
              router.push({ pathname: '/add', params: { catalogId: model.id, status: 'wishlist' } })
            }
          >
            <Text style={styles.actionBtnText}>+ Add to Wish List</Text>
          </Pressable>
        </View>

        {linked.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your entries for this model</Text>
            <View style={styles.grid}>
              {linked.map((item) => (
                <EntryCard
                  key={item.id}
                  number={model.number}
                  name={model.name}
                  category={model.category}
                  year={model.year}
                  photoUri={item.photoUri}
                  color={item.color}
                  condition={item.condition}
                  hasBox={item.hasBox}
                  status={item.status}
                  onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                />
              ))}
            </View>
          </>
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
    padding: 16,
    paddingBottom: 40,
  },
  notFound: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  heroRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  heroInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  number: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  name: {
    fontFamily: fonts.extrabold,
    fontSize: 19,
    color: colors.text,
    marginBottom: 4,
  },
  meta: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryPillText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.accent,
  },
  sectionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  colorChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  colorChipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
