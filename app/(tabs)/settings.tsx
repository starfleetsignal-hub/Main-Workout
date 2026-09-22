import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../src/components/Chip';
import { useCredentials } from '../../src/context/CredentialsContext';
import { useEngine } from '../../src/context/EngineContext';
import { useLicense } from '../../src/context/LicenseContext';
import { colors } from '../../src/theme/colors';
import { radius, shared, spacing } from '../../src/theme/layout';

export default function SettingsScreen() {
  const router = useRouter();
  const { license, daysRemaining, deactivate } = useLicense();
  const { credentials, clear, setMode } = useCredentials();
  const { snapshot, stop } = useEngine();

  const running = snapshot.status === 'running' || snapshot.status === 'starting';

  const onDeactivate = () => {
    Alert.alert(
      'Deactivate this device?',
      'The app locks until you enter a license key again. Keep your key somewhere safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            await stop(false);
            await deactivate();
          },
        },
      ]
    );
  };

  const onDisconnect = () => {
    Alert.alert('Remove broker keys?', 'Your Alpaca keys are deleted from this device. Open positions are untouched.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await stop(false);
          await clear();
        },
      },
    ]);
  };

  const onSwitchMode = () => {
    if (!credentials) return;
    const next = credentials.mode === 'paper' ? 'live' : 'paper';
    if (running) {
      Alert.alert('Stop the engine first', 'Switching between paper and live requires the engine to be stopped.');
      return;
    }
    if (next === 'live') {
      Alert.alert(
        'Switch to live trading?',
        'The engine will place orders with real money in your live Alpaca account. Make sure you have run it in paper mode first and that your rules are what you want.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go live', style: 'destructive', onPress: () => void setMode('live') },
        ]
      );
    } else {
      void setMode('paper');
    }
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <Text style={styles.groupTitle}>License</Text>
      <View style={styles.card}>
        <Row label="Status" value="Activated" tone="up" />
        <Row label="Licensed to" value={license?.sub ?? '—'} />
        <Row label="Plan" value={license?.plan ?? '—'} />
        <Row
          label="Expires"
          value={license?.exp === null ? 'Never' : daysRemaining !== null ? `in ${daysRemaining} day(s)` : '—'}
          tone={daysRemaining !== null && daysRemaining <= 7 ? 'warn' : undefined}
        />
        <Row label="License ID" value={license?.id ? `${license.id.slice(0, 8)}…` : '—'} last />
      </View>
      <Pressable
        onPress={onDeactivate}
        accessibilityRole="button"
        style={({ pressed }) => [shared.buttonGhost, styles.action, pressed && { opacity: 0.7 }]}
      >
        <Text style={[shared.buttonGhostText, { color: colors.warn }]}>Deactivate this device</Text>
      </Pressable>

      <Text style={styles.groupTitle}>Broker</Text>
      <View style={styles.card}>
        <Row label="Broker" value={credentials ? 'Alpaca' : 'Not connected'} />
        <Row
          label="Mode"
          value={credentials ? (credentials.mode === 'paper' ? 'Paper' : 'Live') : '—'}
          tone={credentials ? (credentials.mode === 'live' ? 'down' : 'up') : undefined}
        />
        <Row label="Data feed" value={credentials ? credentials.feed.toUpperCase() : '—'} />
        <Row label="Key ID" value={credentials ? `${credentials.keyId.slice(0, 6)}…` : '—'} />
        <Row label="Account status" value={snapshot.account?.status ?? '—'} last />
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => router.push('/connect')}
          accessibilityRole="button"
          style={({ pressed }) => [shared.button, styles.flex, pressed && { opacity: 0.8 }]}
        >
          <Text style={shared.buttonText}>{credentials ? 'Update keys' : 'Connect Alpaca'}</Text>
        </Pressable>
        {credentials ? (
          <Pressable
            onPress={onSwitchMode}
            accessibilityRole="button"
            style={({ pressed }) => [shared.buttonGhost, styles.flex, pressed && { opacity: 0.7 }]}
          >
            <Text style={shared.buttonGhostText}>{credentials.mode === 'paper' ? 'Go live' : 'Back to paper'}</Text>
          </Pressable>
        ) : null}
      </View>
      {credentials ? (
        <Pressable
          onPress={onDisconnect}
          accessibilityRole="button"
          style={({ pressed }) => [shared.buttonGhost, styles.action, pressed && { opacity: 0.7 }]}
        >
          <Text style={[shared.buttonGhostText, { color: colors.down }]}>Remove broker keys</Text>
        </Pressable>
      ) : null}

      <Text style={styles.groupTitle}>How it decides</Text>
      <View style={[styles.card, styles.prose]}>
        <Text style={styles.proseText}>
          Each symbol is scored out of 100 from six inputs: price versus VWAP, the 9/21 EMA relationship, whether a
          crossover just happened, RSI position, volume against its 20-bar average, and news sentiment. A symbol is
          traded only when it clears your minimum score and no veto applies.
        </Text>
        <Text style={styles.proseText}>
          Vetoes are absolute: a cooldown, a stale feed, a closed market, the daily loss halt, the trade cap, or news
          sentiment below your veto level all block entry regardless of score. Exits run on stop loss, take profit, a
          trailing stop, max hold time, a trend break, hostile news, and the pre-close flatten.
        </Text>
        <Text style={styles.proseText}>
          Sentiment is computed on-device with a financial lexicon that handles negation and intensifiers. No text
          leaves your phone, and no third-party AI service is involved.
        </Text>
      </View>

      <Text style={styles.groupTitle}>Risk</Text>
      <View style={[styles.card, styles.prose]}>
        <Text style={styles.proseText}>
          TradeRunner places real orders through your own brokerage account. Automated trading can lose money faster
          than manual trading, including more than you expect in fast markets. Slippage, gaps, outages and partial
          fills all mean a stop is not a guarantee.
        </Text>
        <Text style={styles.proseText}>
          This app is software, not financial advice, and it makes no promise of profit. Pattern day-trading rules may
          apply to margin accounts under $25,000. Run it in paper mode until you understand its behaviour.
        </Text>
      </View>

      <Pressable
        onPress={() => void Linking.openURL('https://alpaca.markets/docs/').catch(() => {})}
        accessibilityRole="link"
        style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.linkText}>Alpaca documentation</Text>
      </Pressable>
      <Text style={styles.version}>TradeRunner 1.0.0</Text>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  tone,
  last,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'warn';
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {tone ? (
        <Chip label={value} tone={tone} size="sm" />
      ) : (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    gap: spacing.md,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  action: {
    marginTop: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  flex: {
    flex: 1,
  },
  prose: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  proseText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  link: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  linkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  version: {
    color: colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
