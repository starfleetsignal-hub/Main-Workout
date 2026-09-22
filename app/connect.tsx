import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import { ToggleChip } from '../src/components/Chip';
import { ShieldIcon } from '../src/components/icons';
import { defaultWatchlistFor, describeVenue, VENUE_LIST } from '../src/broker/registry';
import type { VenueCredentials, VenueId } from '../src/broker/venues';
import { useCredentials } from '../src/context/CredentialsContext';
import { useEngine } from '../src/context/EngineContext';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import { radius, shared, spacing } from '../src/theme/layout';
import { showAlert } from '../src/utils/alert';

/**
 * One connect screen for every venue. The fields come from the venue
 * descriptor, so adding a venue does not mean writing another form.
 */
export default function ConnectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ venue?: string }>();
  const { credentials, save, verifying } = useCredentials();
  const { parameters, updateParameters } = useEngine();

  const venueId = (params.venue as VenueId) ?? credentials?.venue ?? 'alpaca';
  const venue = useMemo(() => {
    try {
      return describeVenue(venueId);
    } catch {
      return VENUE_LIST[0];
    }
  }, [venueId]);

  const editingSame = credentials?.venue === venue.id;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const field of venue.credentialFields) {
      // Secrets are never pre-filled; the stored value is write-only from here.
      seed[field.key] = editingSame && !field.secret ? String(credentials?.[field.key] ?? '') : '';
    }
    return seed;
  });
  const [mode, setMode] = useState<string>(editingSame ? credentials?.mode ?? defaultMode(venue.id) : defaultMode(venue.id));
  const [feed, setFeed] = useState<string>(editingSame ? credentials?.feed ?? 'iex' : 'iex');
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(!venue.warning);

  const required = venue.credentialFields.filter((f) => !f.optional);
  const complete = required.every((f) => values[f.key]?.trim());

  /**
   * `router.back()` silently no-ops (with only a dev-mode console warning) when
   * this screen was reached with no navigation history to pop — a direct page
   * load or a refresh while sitting on /connect, which is common on web. Falling
   * back to Settings means a successful save always visibly goes somewhere.
   */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/settings');
  };

  const onSave = async () => {
    setError(null);
    const creds: VenueCredentials = { venue: venue.id, ...values };
    if (venue.capabilities.paper) creds.mode = mode;
    if (venue.id === 'alpaca') creds.feed = feed;

    const res = await save(creds);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    // Switching venues leaves a watchlist the new venue cannot trade, so
    // offer to replace it rather than starting in a broken state.
    const stale = parameters.watchlist.filter((s) => !defaultWatchlistFor(venue.id).includes(s));
    if (credentials?.venue !== venue.id && stale.length > 0) {
      showAlert(
        `Use the ${venue.name} watchlist?`,
        `Your current watchlist was set up for another venue. Replace it with symbols ${venue.name} can trade?`,
        [
          { text: 'Keep mine', style: 'cancel', onPress: leave },
          {
            text: 'Replace',
            onPress: () => {
              updateParameters({ watchlist: defaultWatchlistFor(venue.id) });
              leave();
            },
          },
        ]
      );
      return;
    }
    leave();
  };

  return (
    <KeyboardAvoidingView style={shared.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 64, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.venueName}>{venue.name}</Text>
        <Text style={styles.intro}>{venue.blurb}</Text>

        {venue.warning ? (
          <View style={[styles.warnBox, venue.maturity === 'experimental' && styles.warnBoxSevere]}>
            <View style={styles.warnHead}>
              <ShieldIcon size={17} color={venue.maturity === 'experimental' ? colors.down : colors.gold} />
              <Text style={[styles.warnTitle, venue.maturity === 'experimental' && { color: colors.down }]}>
                {venue.maturity === 'experimental' ? 'Read this before connecting' : 'Before you connect'}
              </Text>
            </View>
            <Text style={styles.warnText}>{venue.warning}</Text>
            <Pressable
              onPress={() => setAcknowledged((a) => !a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
              style={styles.ackRow}
            >
              <View style={[styles.checkbox, acknowledged && styles.checkboxOn]}>
                {acknowledged ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.ackText}>I understand and want to continue</Text>
            </Pressable>
          </View>
        ) : null}

        {venue.capabilities.paper ? (
          <>
            <Text style={styles.label}>Mode</Text>
            <View style={styles.chipRow}>
              <ToggleChip
                label={venue.id === 'uphold' ? 'Sandbox' : 'Paper'}
                active={mode !== 'live'}
                onPress={() => setMode(venue.id === 'uphold' ? 'sandbox' : 'paper')}
              />
              <ToggleChip label="Live" active={mode === 'live'} onPress={() => setMode('live')} />
            </View>
            <Text style={mode === 'live' ? styles.warning : styles.hint}>
              {mode === 'live'
                ? 'Live mode places orders with real money. Run it in paper first and confirm it behaves the way you expect.'
                : 'No real money moves in this mode. Start here.'}
            </Text>
          </>
        ) : (
          <View style={styles.noPaper}>
            <Text style={styles.noPaperText}>
              {venue.name} has no paper mode. Every order this venue accepts is real, so size your first runs small.
            </Text>
          </View>
        )}

        {venue.id === 'alpaca' ? (
          <>
            <Text style={styles.label}>Data feed</Text>
            <View style={styles.chipRow}>
              <ToggleChip label="IEX (free)" active={feed !== 'sip'} onPress={() => setFeed('iex')} />
              <ToggleChip label="SIP (paid)" active={feed === 'sip'} onPress={() => setFeed('sip')} />
            </View>
            <Text style={styles.hint}>
              IEX is included with every account and covers a slice of total volume. SIP is the full consolidated tape
              and needs a paid market-data subscription. Neither affects crypto.
            </Text>
          </>
        ) : null}

        {venue.credentialFields.map((field) => (
          <View key={field.key}>
            <Text style={styles.label}>
              {field.label}
              {field.optional ? ' (optional)' : ''}
            </Text>
            <TextInput
              value={values[field.key]}
              onChangeText={(t) => {
                setValues((v) => ({ ...v, [field.key]: t }));
                setError(null);
              }}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={field.secret && !field.multiline}
              multiline={field.multiline}
              style={[shared.input, field.multiline && styles.multiline]}
              accessibilityLabel={field.label}
            />
            {field.help ? <Text style={styles.hint}>{field.help}</Text> : null}
          </View>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={onSave}
          disabled={verifying || !complete || !acknowledged}
          accessibilityRole="button"
          style={({ pressed }) => [
            shared.button,
            { marginTop: spacing.xl },
            (verifying || !complete || !acknowledged) && { opacity: 0.45 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {verifying ? (
            <ActivityIndicator color={colors.onGold} />
          ) : (
            <Text style={shared.buttonText}>Verify and save</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => void Linking.openURL(venue.docsUrl).catch(() => {})}
          accessibilityRole="link"
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkText}>{venue.name} API documentation</Text>
        </Pressable>

        <View style={styles.permBox}>
          <Text style={styles.permTitle}>What the keys are used for</Text>
          <Text style={styles.permText}>
            Reading your balances, streaming or polling prices, submitting and cancelling orders, and closing
            positions. Nothing else. Keys are stored in this device&apos;s keychain and are sent only to {venue.name}.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function defaultMode(id: VenueId): string {
  return id === 'uphold' ? 'sandbox' : 'paper';
}

const styles = StyleSheet.create({
  venueName: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fonts.bold,
  },
  intro: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 4,
    fontFamily: fonts.regular,
  },
  label: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.bold,
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
    fontFamily: fonts.regular,
  },
  warning: {
    color: colors.gold,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
    fontSize: 12.5,
  },
  warnBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warnBoxSevere: {
    backgroundColor: colors.downSoft,
    borderColor: colors.down,
  },
  warnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 6,
  },
  warnTitle: {
    color: colors.gold,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  warnText: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: fonts.regular,
  },
  ackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  checkmark: {
    color: colors.onGold,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  ackText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  noPaper: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noPaperText: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: fonts.regular,
  },
  error: {
    color: colors.down,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
    fontFamily: fonts.regular,
  },
  link: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: colors.cyan,
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
  permBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    padding: spacing.lg,
  },
  permTitle: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  permText: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
});
