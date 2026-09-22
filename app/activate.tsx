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
import { useLicense } from '../src/context/LicenseContext';
import { LICENSE_PUBLIC_KEY_HEX, PURCHASE_URL } from '../src/license/publicKey';
import { colors } from '../src/theme/colors';
import { radius, shared, spacing } from '../src/theme/layout';

const FEATURES = [
  'Live trade, quote and bar streams for stocks and crypto',
  'Real-time news scored for sentiment and wired into entries',
  'Automated entries and exits inside limits you set',
  'Stop loss, take profit, trailing stop and time-based exits',
  'Daily loss and trade-count circuit breakers',
];

export default function ActivateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activate, lockReason } = useLicense();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const noPublicKey = LICENSE_PUBLIC_KEY_HEX.length !== 64;

  const onActivate = async () => {
    setBusy(true);
    setError(null);
    const res = await activate(key);
    setBusy(false);
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandMark}>
          <Text style={styles.brandGlyph}>▲</Text>
        </View>
        <Text style={styles.brand}>TradeRunner</Text>
        <Text style={styles.tagline}>
          An automated day-trading desk for stocks and crypto, driven by live prices and real-time news.
        </Text>

        <View style={styles.featureCard}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.featureDot}>•</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {lockReason ? (
          <View style={[styles.banner, { borderColor: colors.warn, backgroundColor: colors.warnSoft }]}>
            <Text style={[styles.bannerText, { color: colors.warn }]}>{lockReason}</Text>
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

        <Text style={styles.inputLabel}>License key</Text>
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
            (busy || !key.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={shared.buttonText}>Activate</Text>}
        </Pressable>

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
          TradeRunner places real orders through your own brokerage account. Trading involves risk, including the loss
          of your entire investment. Nothing here is financial advice. Start in paper mode.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brandGlyph: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '800',
  },
  brand: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  featureCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  featureDot: {
    color: colors.accent,
    fontSize: 14,
    lineHeight: 20,
  },
  featureText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
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
  },
  inputLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
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
  },
  cta: {
    marginTop: spacing.lg,
  },
  secondary: {
    marginTop: spacing.md,
  },
  legal: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.xl,
  },
});
