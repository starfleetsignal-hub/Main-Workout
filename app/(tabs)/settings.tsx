import { useIsFocused, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '../../src/components/Chip';
import { ShieldIcon, SignalIcon } from '../../src/components/icons';
import { useCredentials } from '../../src/context/CredentialsContext';
import { useEngine } from '../../src/context/EngineContext';
import { useLicense } from '../../src/context/LicenseContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { ScreenTitle } from '../../src/components/ScreenTitle';
import { clearCrashLog, getCrashLog, type CrashEntry } from '../../src/errors/crashLog';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../../src/license/publicKey';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { radius, shared, spacing } from '../../src/theme/layout';
import { showAlert } from '../../src/utils/alert';

export default function SettingsScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    license,
    daysRemaining,
    deactivate,
    activation,
    activationEnabled,
    seats,
    deviceId,
    busy,
    refreshActivation,
    notice,
    remoteFlatten,
  } = useLicense();
  const { credentials, venue, clear, setMode } = useCredentials();
  const { snapshot, stop } = useEngine();
  const { enabled: alertsEnabled, supported: alertsSupported, setEnabled: setAlertsEnabled } = useNotifications();
  const [crashLog, setCrashLog] = useState<CrashEntry[]>([]);

  useEffect(() => {
    void getCrashLog().then(setCrashLog);
  }, []);

  const running = snapshot.status === 'running' || snapshot.status === 'starting';

  const onClearCrashLog = () => {
    showAlert('Clear the error log?', 'This only removes the on-device record; it does not affect trading.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearCrashLog();
          setCrashLog([]);
        },
      },
    ]);
  };

  const onToggleAlerts = async (next: boolean) => {
    const result = await setAlertsEnabled(next);
    if (next && !result) {
      showAlert(
        'Notifications are off',
        'TradeRunner is not allowed to send notifications. Turn them on for this app in your device Settings, then try again.'
      );
    }
  };

  const onDeactivate = () => {
    showAlert(
      'Deactivate this device?',
      activationEnabled
        ? 'This frees the seat so you can use your license on another device. The app locks here until you enter a key again.'
        : 'The app locks until you enter a license key again. Keep your key somewhere safe.',
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
    showAlert('Remove venue keys?', 'Your API keys are deleted from this device. Open positions are untouched.', [
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
    if (!credentials || !venue?.capabilities.paper) return;
    const next = credentials.mode === 'live' ? (venue.id === 'uphold' ? 'sandbox' : 'paper') : 'live';
    if (running) {
      showAlert('Stop the engine first', 'Switching between paper and live requires the engine to be stopped.');
      return;
    }
    if (next === 'live') {
      showAlert(
        'Switch to live trading?',
        `The engine will place orders with real money in your ${venue.name} account. Make sure you have run it in paper mode first.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go live', style: 'destructive', onPress: () => void setMode('live') },
        ]
      );
    } else {
      void setMode(next);
    }
  };

  const activationLabel = (() => {
    switch (activation.status) {
      case 'active':
        return { text: 'Checked in', tone: 'up' as const };
      case 'grace':
        return { text: 'Offline', tone: 'gold' as const };
      case 'offline':
        return { text: 'Unreachable', tone: 'gold' as const };
      case 'revoked':
        return { text: 'Revoked', tone: 'down' as const };
      case 'seat_limit':
        return { text: 'Seat limit', tone: 'down' as const };
      default:
        return { text: 'Not checked in', tone: 'neutral' as const };
    }
  })();

  // See the matching comment in dashboard.tsx: an unfocused tab must render
  // nothing, since a transparent background alone doesn't hide it behind the
  // focused one.
  if (!isFocused) return null;

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: 120 }}
    >
      <ScreenTitle>Settings</ScreenTitle>
      {remoteFlatten ? (
        <View style={styles.flattenNotice}>
          <ShieldIcon size={16} color={colors.down} />
          <Text style={styles.flattenNoticeText}>
            Remote flatten requested: {remoteFlatten.reason} All open positions are closed on every check-in until
            this is cleared.
          </Text>
        </View>
      ) : null}

      {notice ? (
        <View style={styles.notice}>
          <SignalIcon size={16} color={colors.gold} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <Text style={styles.groupTitle}>License</Text>
      <View style={styles.card}>
        <Row label="Status" value="Activated" tone="up" />
        <Row label="Licensed to" value={license?.sub ?? '—'} />
        <Row label="Plan" value={license?.plan ?? '—'} />
        <Row
          label="Expires"
          value={license?.exp === null ? 'Never' : daysRemaining !== null ? `in ${daysRemaining} day(s)` : '—'}
          tone={daysRemaining !== null && daysRemaining <= 7 ? 'gold' : undefined}
        />
        <Row label="License ID" value={license?.id ? `${license.id.slice(0, 8)}…` : '—'} last />
      </View>

      {activationEnabled ? (
        <>
          <Text style={styles.groupTitle}>Devices</Text>
          <View style={styles.card}>
            <Row label="Activation" value={activationLabel.text} tone={activationLabel.tone} />
            <Row label="Devices in use" value={seats ? `${seats.used} of ${seats.max}` : '—'} />
            <Row label="This device" value={deviceId ? `${deviceId.slice(0, 8)}…` : '—'} />
            <Row
              label="Next check-in"
              value={
                activation.status === 'active'
                  ? new Date(activation.lease.exp * 1000).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '—'
              }
              last
            />
          </View>
          <Pressable
            onPress={() => void refreshActivation()}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [shared.buttonGhost, styles.action, pressed && { opacity: 0.7 }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={shared.buttonGhostText}>Check in now</Text>
            )}
          </Pressable>
        </>
      ) : null}

      <Pressable
        onPress={onDeactivate}
        accessibilityRole="button"
        style={({ pressed }) => [shared.buttonGhost, styles.action, pressed && { opacity: 0.7 }]}
      >
        <Text style={[shared.buttonGhostText, { color: colors.gold }]}>Deactivate this device</Text>
      </Pressable>

      <Text style={styles.groupTitle}>Notifications</Text>
      <View style={styles.card}>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <View style={styles.flex}>
            <Text style={styles.rowLabel}>Trade alerts</Text>
            <Text style={styles.rowSub}>
              {alertsSupported
                ? 'A halt, an engine error, a remote flatten, or a stop-loss exit — nothing routine.'
                : 'Requires the iOS or Android app; not available in a web build.'}
            </Text>
          </View>
          <Switch
            value={alertsEnabled}
            onValueChange={(v) => void onToggleAlerts(v)}
            disabled={!alertsSupported}
            trackColor={{ false: colors.cardLine, true: colors.goldLine }}
            thumbColor={alertsEnabled ? colors.gold : undefined}
          />
        </View>
      </View>

      <Text style={styles.groupTitle}>Venue</Text>
      <View style={styles.card}>
        <Row label="Trading through" value={venue?.name ?? 'Not connected'} />
        <Row
          label="Mode"
          value={
            credentials
              ? venue?.capabilities.paper
                ? credentials.mode === 'live'
                  ? 'Live'
                  : venue.id === 'uphold'
                    ? 'Sandbox'
                    : 'Paper'
                : 'Live only'
              : '—'
          }
          tone={credentials ? (credentials.mode === 'live' || !venue?.capabilities.paper ? 'down' : 'up') : undefined}
        />
        {venue?.id === 'alpaca' ? <Row label="Data feed" value={String(credentials?.feed ?? 'iex').toUpperCase()} /> : null}
        <Row label="Account status" value={snapshot.account?.status ?? '—'} last />
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => router.push('/venues')}
          accessibilityRole="button"
          style={({ pressed }) => [shared.button, styles.flex, pressed && { opacity: 0.85 }]}
        >
          <Text style={shared.buttonText}>{credentials ? 'Change venue' : 'Connect a venue'}</Text>
        </Pressable>
        {credentials && venue?.capabilities.paper ? (
          <Pressable
            onPress={onSwitchMode}
            accessibilityRole="button"
            style={({ pressed }) => [shared.buttonGhost, styles.flex, pressed && { opacity: 0.7 }]}
          >
            <Text style={shared.buttonGhostText}>{credentials.mode === 'live' ? 'Back to paper' : 'Go live'}</Text>
          </Pressable>
        ) : null}
      </View>
      {credentials ? (
        <Pressable
          onPress={onDisconnect}
          accessibilityRole="button"
          style={({ pressed }) => [shared.buttonGhost, styles.action, pressed && { opacity: 0.7 }]}
        >
          <Text style={[shared.buttonGhostText, { color: colors.down }]}>Remove venue keys</Text>
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
          leaves your phone, and no third-party AI service is involved. Venues without a news feed score that
          component neutral rather than guessing.
        </Text>
      </View>

      <Text style={styles.groupTitle}>Risk</Text>
      <View style={[styles.card, styles.prose]}>
        <Text style={styles.proseText}>
          TradeRunner places real orders through your own account. Automated trading can lose money faster than manual
          trading. Slippage, gaps, outages and partial fills all mean a stop is not a guarantee.
        </Text>
        <Text style={styles.proseText}>
          On venues with no paper mode every order is real from the first run. On a self-custody wallet swaps are
          irreversible and there is no one to call. Size your first runs accordingly.
        </Text>
        <Text style={styles.proseText}>
          This app is software, not financial advice, and it makes no promise of profit. Pattern day-trading rules may
          apply to margin accounts under $25,000.
        </Text>
      </View>

      <Text style={styles.groupTitle}>Diagnostics</Text>
      <View style={[styles.card, styles.prose]}>
        {crashLog.length === 0 ? (
          <Text style={styles.proseText}>No errors recorded on this device.</Text>
        ) : (
          <>
            {crashLog.slice(0, 5).map((c) => (
              <View key={c.id} style={styles.crashRow}>
                <Text style={styles.crashTime}>{new Date(c.at).toLocaleString()}</Text>
                <Text style={styles.crashMessage} numberOfLines={2}>
                  {c.message}
                </Text>
              </View>
            ))}
            <Pressable onPress={onClearCrashLog} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <Text style={styles.crashClear}>Clear log ({crashLog.length})</Text>
            </Pressable>
          </>
        )}
      </View>

      {venue ? (
        <Pressable
          onPress={() => void Linking.openURL(venue.docsUrl).catch(() => {})}
          accessibilityRole="link"
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkText}>{venue.name} documentation</Text>
        </Pressable>
      ) : null}
      {PRIVACY_POLICY_URL || TERMS_URL ? (
        <View style={styles.legalRow}>
          {PRIVACY_POLICY_URL ? (
            <Pressable onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})} accessibilityRole="link">
              <Text style={styles.linkText}>Privacy policy</Text>
            </Pressable>
          ) : null}
          {TERMS_URL ? (
            <Pressable onPress={() => void Linking.openURL(TERMS_URL).catch(() => {})} accessibilityRole="link">
              <Text style={styles.linkText}>Terms of use</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.version}>TradeRunner 1.1.0</Text>
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
  tone?: 'up' | 'down' | 'gold' | 'neutral';
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
  flattenNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.downSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.down,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  flattenNoticeText: {
    flex: 1,
    color: colors.down,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noticeText: {
    flex: 1,
    color: colors.gold,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  groupTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardLine,
    gap: spacing.md,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.semibold,
    flexShrink: 1,
  },
  rowSub: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: fonts.regular,
    marginTop: 2,
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
    fontFamily: fonts.regular,
  },
  crashRow: {
    gap: 2,
  },
  crashTime: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  crashMessage: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  crashClear: {
    color: colors.down,
    fontSize: 12.5,
    fontFamily: fonts.semibold,
    marginTop: spacing.xs,
  },
  link: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  linkText: {
    color: colors.cyan,
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
  version: {
    color: colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.md,
    fontFamily: fonts.regular,
  },
});
