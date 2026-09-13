import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Category } from '../data/types';
import { categoryColors } from '../theme/colors';

const CATEGORY_GLYPH: Record<Category, string> = {
  'Muscle Car': '🏁',
  'Sports Car': '🏎️',
  Classic: '🚗',
  'SUV & Truck': '🚙',
  'Emergency & Rescue': '🚒',
  Construction: '🚜',
  Military: '🪖',
  'Bus & Van': '🚌',
  Motorcycle: '🏍️',
  Racing: '🏁',
  Novelty: '🚕',
};

export function ModelThumb({
  category,
  photoUri,
  size = 64,
}: {
  category?: Category;
  photoUri?: string;
  size?: number;
}) {
  const tint = category ? categoryColors[category] : '#4DA3FF';

  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={[styles.thumb, { width: size, height: size, borderRadius: size * 0.22 }]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.thumb,
        styles.placeholder,
        { width: size, height: size, borderRadius: size * 0.22, backgroundColor: `${tint}26` },
      ]}
    >
      <Text style={{ fontSize: size * 0.42 }}>{category ? CATEGORY_GLYPH[category] : '🚗'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
