import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { fonts } from './fonts';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 };

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    // The starfield paints the background, so screens sit on top of it.
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontFamily: fonts.bold,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.semibold,
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  input: {
    backgroundColor: 'rgba(5,7,15,0.55)',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLineStrong,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonText: {
    color: colors.onGold,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  buttonGhost: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLineStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhostText: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
  /** The gold pill used for streaks and highlights in CosmoPlan. */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  pillText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
});
