import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModelThumb } from '../../src/components/ModelThumb';
import { useCollection } from '../../src/context/CollectionContext';
import { colors, conditionColors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { resolveEntry } from '../../src/utils/display';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getItem, updateItem, removeItem } = useCollection();
  const item = getItem(id);

  if (!item) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.notFound}>This entry was removed.</Text>
      </SafeAreaView>
    );
  }

  const info = resolveEntry(item);

  const handleDelete = () => {
    Alert.alert('Delete this entry?', `This removes "${info.name}" from your collection.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeItem(item.id);
          router.back();
        },
      },
    ]);
  };

  const toggleStatus = () => {
    updateItem(item.id, { status: item.status === 'owned' ? 'wishlist' : 'owned' });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ title: info.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <ModelThumb category={info.category} photoUri={item.photoUri} size={110} />
          <View style={styles.heroInfo}>
            <Text style={styles.number}>#{info.number}</Text>
            <Text style={styles.name}>{info.name}</Text>
            <Text style={styles.meta}>
              {info.series}
              {info.year ? ` · ${info.year}` : ''}
            </Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: item.status === 'owned' ? colors.successSoft : colors.wishlistSoft },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: item.status === 'owned' ? colors.success : colors.wishlist },
                ]}
              >
                {item.status === 'owned' ? 'In My Garage' : 'On Wish List'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.detailGrid}>
          <DetailRow label="Color" value={item.color} />
          {item.status === 'owned' && (
            <DetailRow
              label="Condition"
              value={item.condition}
              valueColor={conditionColors[item.condition]}
            />
          )}
          {item.status === 'owned' && <DetailRow label="Box" value={item.hasBox ? 'Yes' : 'No'} />}
          <DetailRow label="Quantity" value={String(item.quantity)} />
          {item.purchasePrice != null && (
            <DetailRow label="Purchase Price" value={`$${item.purchasePrice.toFixed(2)}`} />
          )}
          {item.purchaseDate ? <DetailRow label="Purchase Date" value={item.purchaseDate} /> : null}
        </View>

        {item.notes ? (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{item.notes}</Text>
          </>
        ) : null}

        <View style={styles.actionsCol}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.accentSoft }]}
            onPress={() => router.push({ pathname: '/add', params: { id: item.id } })}
          >
            <Text style={[styles.actionBtnText, { color: colors.accent }]}>Edit Entry</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={toggleStatus}>
            <Text style={[styles.actionBtnText, { color: colors.text }]}>
              {item.status === 'owned' ? 'Move to Wish List' : 'Move to Garage'}
            </Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.dangerSoft }]} onPress={handleDelete}>
            <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete Entry</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
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
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  detailGrid: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 4,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  detailLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  notes: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginBottom: 20,
  },
  actionsCol: {
    gap: 10,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
