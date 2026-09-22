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
import { ToggleChip } from '../src/components/Chip';
import { useCredentials } from '../src/context/CredentialsContext';
import type { AlpacaFeed, AlpacaMode } from '../src/broker/alpaca/rest';
import { colors } from '../src/theme/colors';
import { radius, shared, spacing } from '../src/theme/layout';

export default function ConnectScreen() {
  const router = useRouter();
  const { credentials, save, verifying } = useCredentials();
  const [keyId, setKeyId] = useState(credentials?.keyId ?? '');
  const [secret, setSecret] = useState('');
  const [mode, setMode] = useState<AlpacaMode>(credentials?.mode ?? 'paper');
  const [feed, setFeed] = useState<AlpacaFeed>(credentials?.feed ?? 'iex');
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);
    const res = await save(keyId, secret, mode, feed);
    if (res.ok) router.back();
    else setError(res.error);
  };

  return (
    <KeyboardAvoidingView style={shared.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          TradeRunner trades through your own Alpaca account. Generate API keys in the Alpaca dashboard and paste them
          here. They are stored in this device's keychain and sent only to Alpaca.
        </Text>

        <Text style={styles.label}>Mode</Text>
        <View style={styles.chipRow}>
          <ToggleChip label="Paper" active={mode === 'paper'} onPress={() => setMode('paper')} />
          <ToggleChip label="Live" active={mode === 'live'} onPress={() => setMode('live')} />
        </View>
        {mode === 'live' ? (
          <Text style={styles.warning}>
            Live mode places orders with real money. Run the engine in paper mode first and confirm it behaves the way
            you expect.
          </Text>
        ) : (
          <Text style={styles.hint}>Paper keys come from the paper-trading section of the dashboard, not the live one.</Text>
        )}

        <Text style={styles.label}>Data feed</Text>
        <View style={styles.chipRow}>
          <ToggleChip label="IEX (free)" active={feed === 'iex'} onPress={() => setFeed('iex')} />
          <ToggleChip label="SIP (paid)" active={feed === 'sip'} onPress={() => setFeed('sip')} />
        </View>
        <Text style={styles.hint}>
          IEX is included with every account and covers a slice of total volume. SIP is the full consolidated tape and
          needs a paid market-data subscription.
        </Text>

        <Text style={styles.label}>API key ID</Text>
        <TextInput
          value={keyId}
          onChangeText={setKeyId}
          placeholder="PK…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={shared.input}
          accessibilityLabel="API key ID"
        />

        <Text style={styles.label}>API secret key</Text>
        <TextInput
          value={secret}
          onChangeText={setSecret}
          placeholder={credentials ? 'Enter the secret again to update' : 'Secret'}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={shared.input}
          accessibilityLabel="API secret key"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={onSave}
          disabled={verifying || !keyId.trim() || !secret.trim()}
          accessibilityRole="button"
          style={({ pressed }) => [
            shared.button,
            { marginTop: spacing.xl },
            (verifying || !keyId.trim() || !secret.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {verifying ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={shared.buttonText}>Verify and save</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => void Linking.openURL('https://app.alpaca.markets/paper/dashboard/overview').catch(() => {})}
          accessibilityRole="link"
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkText}>Open the Alpaca dashboard</Text>
        </Pressable>

        <View style={styles.permBox}>
          <Text style={styles.permTitle}>What the keys are used for</Text>
          <Text style={styles.permText}>
            Reading your account equity and buying power, streaming prices and news, submitting and cancelling orders,
            and closing positions. Nothing else, and nothing is sent anywhere except Alpaca.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  label: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  warning: {
    color: colors.warn,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.down,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  link: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  permBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  permTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  permText: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
  },
});
