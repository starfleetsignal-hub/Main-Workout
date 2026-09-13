import { Link } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFavorites } from '../context/FavoritesContext';
import { colors, groupColors } from '../theme/colors';
import { Muscle } from '../data/types';

export function MuscleCard({ muscle }: { muscle: Muscle }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(muscle.id);
  const groupColor = groupColors[muscle.group] ?? colors.accent;

  return (
    <Link href={{ pathname: '/muscle/[id]', params: { id: muscle.id } }} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <View style={[styles.stripe, { backgroundColor: groupColor }]} />
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.name}>{muscle.name}</Text>
            <Pressable
              hitSlop={10}
              onPress={(e) => {
                e.stopPropagation();
                toggleFavorite(muscle.id);
              }}
            >
              <Text style={[styles.star, fav && styles.starActive]}>{fav ? '★' : '☆'}</Text>
            </Pressable>
          </View>
          <Text style={styles.short} numberOfLines={2}>
            {muscle.short}
          </Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: groupColor + '26' }]}>
              <Text style={[styles.tagText, { color: groupColor }]}>{muscle.group}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardPressed: {
    opacity: 0.8,
  },
  stripe: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  star: {
    fontSize: 20,
    color: colors.textFaint,
  },
  starActive: {
    color: colors.favorite,
  },
  short: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
