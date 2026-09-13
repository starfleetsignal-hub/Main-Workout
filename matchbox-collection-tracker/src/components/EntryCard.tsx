import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category, CollectionStatus, Condition } from '../data/types';
import { colors, conditionColors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { ModelThumb } from './ModelThumb';

interface EntryCardProps {
  number: string;
  name: string;
  category?: Category;
  year?: number;
  photoUri?: string;
  color?: string;
  condition?: Condition;
  hasBox?: boolean;
  status: CollectionStatus | 'none';
  onPress: () => void;
  onQuickAdd?: () => void;
}

export function EntryCard({
  number,
  name,
  category,
  year,
  photoUri,
  color,
  condition,
  hasBox,
  status,
  onPress,
  onQuickAdd,
}: EntryCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumbWrap}>
        <ModelThumb category={category} photoUri={photoUri} size={100} />
        {year != null && (
          <View style={styles.yearBadge}>
            <Text style={styles.yearBadgeText}>{year}</Text>
          </View>
        )}
        {status === 'owned' && (
          <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
            <Text style={styles.statusBadgeText}>✓</Text>
          </View>
        )}
        {status === 'wishlist' && (
          <View style={[styles.statusBadge, { backgroundColor: colors.wishlist }]}>
            <Text style={styles.statusBadgeText}>♥</Text>
          </View>
        )}
        {status === 'none' && onQuickAdd && (
          <Pressable style={styles.addBadge} onPress={onQuickAdd} hitSlop={8}>
            <Text style={styles.addBadgeText}>+</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.number}>#{number}</Text>
        {hasBox != null && (
          <View
            style={[
              styles.pill,
              { backgroundColor: hasBox ? colors.successSoft : colors.dangerSoft },
            ]}
          >
            <Text style={[styles.pillText, { color: hasBox ? colors.success : colors.danger }]}>
              Box: {hasBox ? 'Yes' : 'No'}
            </Text>
          </View>
        )}
      </View>
      {(color || condition) && (
        <View style={styles.metaRow}>
          {color && (
            <Text style={styles.colorText} numberOfLines={1}>
              {color}
            </Text>
          )}
          {condition && (
            <View style={[styles.pill, { backgroundColor: `${conditionColors[condition]}26` }]}>
              <Text style={[styles.pillText, { color: conditionColors[condition] }]}>{condition}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  thumbWrap: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 8,
  },
  yearBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(11,18,32,0.75)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  yearBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.text,
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  statusBadgeText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  addBadgeText: {
    color: colors.onAccent,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 18,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 4,
    minHeight: 34,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  number: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
  },
  colorText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
    flexShrink: 1,
  },
  pill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
});
