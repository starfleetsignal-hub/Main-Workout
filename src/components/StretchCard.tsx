import React, { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { PoseIcon } from './PoseIcon';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Stretch } from '../data/types';

export function StretchCard({ stretch, index }: { stretch: Stretch; index: number }) {
  const [open, setOpen] = useState(index === 0);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={toggle}>
        <View style={styles.poseBadge}>
          <PoseIcon pose={stretch.pose} color={colors.stretch} size={30} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{stretch.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{stretch.type}</Text>
            </View>
            <Text style={styles.meta}>{stretch.hold}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open && (
        <View style={styles.body}>
          {stretch.instructions.map((step, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.bullet}>{i + 1}.</Text>
              <Text style={styles.rowText}>{step}</Text>
            </View>
          ))}
          <Text style={styles.frequency}>Frequency: {stretch.frequency}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  poseBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.stretchSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  badge: {
    backgroundColor: colors.stretchSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: colors.stretch,
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 22,
    paddingLeft: 8,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  bullet: {
    color: colors.textMuted,
    width: 20,
    fontSize: 13,
  },
  rowText: {
    color: colors.text,
    fontSize: 13.5,
    flex: 1,
    lineHeight: 19,
  },
  frequency: {
    color: colors.stretch,
    fontSize: 13,
    fontFamily: fonts.semibold,
    marginTop: 8,
  },
});
