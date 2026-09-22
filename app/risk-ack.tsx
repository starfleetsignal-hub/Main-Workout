import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldIcon } from '../src/components/icons';
import { useRisk } from '../src/context/RiskContext';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../src/license/publicKey';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import { radius, shared, spacing } from '../src/theme/layout';

interface Term {
  title: string;
  body: string;
}

const TERMS: Term[] = [
  {
    title: 'This trades with real money automatically',
    body: 'TradeRunner places live orders through your own brokerage or exchange account without asking you to confirm each one. Once the engine is running, it will buy and sell inside the limits you set, on its own, whenever a symbol clears those rules.',
  },
  {
    title: 'No profit is promised or implied',
    body: 'Nothing in this app is financial advice, and no preset, score, or past result is a prediction of what will happen next. Automated rules can lose money as easily as they can make it, and can lose it faster than a person watching the market by hand.',
  },
  {
    title: 'The software has real limitations',
    body: 'A stop-loss is an instruction, not a guarantee: gaps, halts, thin liquidity and slippage can all produce a fill far from where you expected one. The engine only manages a position while your device stays on, connected, and the app is running — if either fails with a position open, that position sits unmanaged until you reconnect.',
  },
  {
    title: 'Compliance is your responsibility',
    body: 'Rules like pattern day-trading requirements, margin eligibility, tax treatment of trades, and which assets you may legally trade all depend on your account, your broker, and where you live. This app does not check any of that for you.',
  },
  {
    title: 'You are responsible for what you configure',
    body: 'Position sizing, risk limits, which symbols are watched, and whether the engine is even running are all choices you make in Rules and Settings. Review them before you connect a live account, and start in paper mode wherever the venue offers one.',
  },
];

export default function RiskAckScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { acknowledge } = useRisk();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (!checked || busy) return;
    setBusy(true);
    await acknowledge();
    router.replace('/(tabs)/dashboard');
  };

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <View style={styles.header}>
        <ShieldIcon size={28} color={colors.gold} />
        <Text style={styles.title}>Before you trade</Text>
      </View>
      <Text style={styles.intro}>
        Read this once. It covers the app as a whole; each venue you connect may add its own warning on top of this.
      </Text>

      {TERMS.map((term) => (
        <View key={term.title} style={styles.card}>
          <Text style={styles.cardTitle}>{term.title}</Text>
          <Text style={styles.cardBody}>{term.body}</Text>
        </View>
      ))}

      <Pressable
        onPress={() => setChecked((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.ackRow}
      >
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>{checked ? <Text style={styles.checkmark}>✓</Text> : null}</View>
        <Text style={styles.ackText}>
          I have read this, understand the risk, and want to continue at my own risk.
        </Text>
      </Pressable>

      {PRIVACY_POLICY_URL || TERMS_URL ? (
        <Text style={styles.legalText}>
          By continuing you also agree to the{' '}
          {PRIVACY_POLICY_URL ? (
            <Text style={styles.legalLink} onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}>
              Privacy Policy
            </Text>
          ) : null}
          {PRIVACY_POLICY_URL && TERMS_URL ? ' and ' : ''}
          {TERMS_URL ? (
            <Text style={styles.legalLink} onPress={() => void Linking.openURL(TERMS_URL).catch(() => {})}>
              Terms of Use
            </Text>
          ) : null}
          .
        </Text>
      ) : null}

      <Pressable
        onPress={onContinue}
        disabled={!checked || busy}
        accessibilityRole="button"
        style={({ pressed }) => [
          shared.button,
          styles.cta,
          (!checked || busy) && { opacity: 0.45 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={shared.buttonText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fonts.bold,
  },
  intro: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: fonts.regular,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
  },
  ackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  checkmark: {
    color: colors.onGold,
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  ackText: {
    flex: 1,
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fonts.medium,
  },
  legalText: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    marginTop: spacing.sm,
  },
  legalLink: {
    color: colors.cyan,
    fontFamily: fonts.medium,
  },
  cta: {
    marginTop: spacing.xl,
  },
});
