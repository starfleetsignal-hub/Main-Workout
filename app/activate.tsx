import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, LockIcon } from '../src/components/icons';
import { useLicense } from '../src/context/LicenseContext';
import { LICENSE_PUBLIC_KEY_HEX, PURCHASE_URL } from '../src/license/publicKey';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import { radius, shared, spacing } from '../src/theme/layout';

const FEATURES = [
  'Live prices and real-time news across five venues',
  'Stocks and crypto, or crypto alone',
  'Automated entries and exits inside limits you set',
  'Stop loss, take profit, trailing stop and time exits',
  'Daily loss and trade-count circuit breakers',
];

export default function ActivateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activate, lockReason, busy, activationEnabled } = useLicense();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const noPublicKey = LICENSE_PUBLIC_KEY_HEX.length !== 64;

  const onActivate = async () => {
    setError(null);
    const res = await activate(key);
    if (res.ok) router.replace('/(tabs)/dashboard');
    else setError(res.error);
  };

  return (
    <KeyboardAvoidingView
      style={shared.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <BrandMark size={72} />
          <Text style={styles.brand}>TradeRunner</Text>
          <Text style={styles.tagline}>
            An automated day-trading desk for stocks and crypto, driven by live prices and real-time news.
          </Text>
        </View>

        <View style={styles.featureCard}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <View style={styles.bullet} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {lockReason ? (
          <View style={[styles.banner, { borderColor: colors.down, backgroundColor: colors.downSoft }]}>
            <Text style={[styles.bannerText, { color: colors.down }]}>{lockReason}</Text>
          </View>
        ) : null}

        {noPublicKey ? (
          <View style={[styles.banner, { borderColor: colors.down, backgroundColor: colors.downSoft }]}>
            <Text style={[styles.bannerText, { color: colors.down }]}>
              This build has no license public key. Run `npm run license:keygen` and rebuild, otherwise no key can
              activate it.
            </Text>
          </View>
        ) : null}

        <View style={styles.labelRow}>
          <LockIcon size={15} color={colors.gold} />
          <Text style={styles.inputLabel}>License key</Text>
        </View>
        <TextInput
          value={key}
          onChangeText={(t) => {
            setKey(t);
            setError(null);
          }}
          placeholder="TR1.…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={3}
          style={[shared.input, styles.keyInput]}
          accessibilityLabel="License key"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={onActivate}
          disabled={busy || !key.trim()}
          accessibilityRole="button"
          style={({ pressed }) => [
            shared.button,
            styles.cta,
            (busy || !key.trim()) && { opacity: 0.45 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {busy ? <ActivityIndicator color={colors.onGold} /> : <Text style={shared.buttonText}>Activate</Text>}
        </Pressable>

        {activationEnabled ? (
          <Text style={styles.activationNote}>
            Activation registers this device against your license. You can move it to another device from Settings.
          </Text>
        ) : null}

        {PURCHASE_URL ? (
          <Pressable
            onPress={() => void Linking.openURL(PURCHASE_URL).catch(() => {})}
            accessibilityRole="link"
            style={({ pressed }) => [shared.buttonGhost, styles.secondary, pressed && { opacity: 0.7 }]}
          >
            <Text style={shared.buttonGhostText}>Buy a license</Text>
          </Pressable>
        ) : null}

        <Text style={styles.legal}>
          TradeRunner places real orders through your own brokerage or exchange account. Trading involves risk,
          including the loss of your entire investment. Nothing here is financial advice. Start in paper mode.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontFamily: fonts.bold,
    marginTop: spacing.md,
    letterSpacing: 0.3,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 14.5,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  featureCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    padding: spacing.lg,
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
    marginTop: 7,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  featureText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  banner: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  inputLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  keyInput: {
    minHeight: 84,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  error: {
    color: colors.down,
    fontSize: 13,
    marginTop: spacing.sm,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  cta: {
    marginTop: spacing.lg,
  },
  activationNote: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: spacing.md,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  secondary: {
    marginTop: spacing.md,
  },
  legal: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.xl,
    fontFamily: fonts.regular,
  },
});
