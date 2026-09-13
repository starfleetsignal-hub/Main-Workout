import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export function AppHeader({
  title,
  onRightPress,
  rightIcon = '⚙️',
}: {
  title: string;
  onRightPress?: () => void;
  rightIcon?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onRightPress && (
        <Pressable onPress={onRightPress} hitSlop={10} style={styles.iconBtn}>
          <Text style={styles.icon}>{rightIcon}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    letterSpacing: 0.5,
    color: colors.text,
    flexShrink: 1,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  icon: {
    fontSize: 15,
  },
});
