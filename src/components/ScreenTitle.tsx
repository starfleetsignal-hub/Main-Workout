import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

/**
 * Each tab renders its own title rather than relying on the navigation
 * header. React Navigation keeps every tab's header mounted at once,
 * distinguishing the focused one only by z-index — with this app's
 * transparent header background (needed for the starfield), that left
 * every tab's title text visibly stacked in the same corner. A title that's
 * part of the screen's own content disappears along with the rest of it
 * when the screen isn't focused.
 */
export function ScreenTitle({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 19,
    fontFamily: fonts.bold,
  },
});
