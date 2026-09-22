import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '../src/components/Chip';
import { ShieldIcon } from '../src/components/icons';
import { VENUE_LIST } from '../src/broker/registry';
import type { VenueDescriptor } from '../src/broker/venues';
import { useCredentials } from '../src/context/CredentialsContext';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import { radius, shared, spacing } from '../src/theme/layout';

/**
 * The venue picker. Every venue states plainly what it can do and how far it
 * has been tested, because the differences between them change what the
 * engine is able to do, and a buyer deserves to know that before they
 * connect an account with money in it.
 */
export default function VenuesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { credentials } = useCredentials();

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 64, paddingBottom: spacing.xxl }}
    >
      <Text style={styles.intro}>
        TradeRunner trades through an account you already own. Pick where, then paste that venue&apos;s API keys.
      </Text>

      {VENUE_LIST.map((venue) => (
        <VenueCard
          key={venue.id}
          venue={venue}
          connected={credentials?.venue === venue.id}
          onPress={() => router.push(`/connect?venue=${venue.id}`)}
        />
      ))}

      <Text style={styles.footnote}>
        Only Alpaca has been run against a live account from this codebase. The others are written to each venue&apos;s
        published API and covered by tests, but you should put a small amount through them first and check the fills
        against the venue&apos;s own history.
      </Text>
    </ScrollView>
  );
}

function VenueCard({
  venue,
  connected,
  onPress,
}: {
  venue: VenueDescriptor;
  connected: boolean;
  onPress: () => void;
}) {
  const caps = venue.capabilities;
  const features = [
    caps.stocks && 'Stocks',
    caps.crypto && 'Crypto',
    caps.paper && 'Paper mode',
    caps.streaming ? 'Live feed' : 'Polled prices',
    caps.news && 'News',
    caps.shorts && 'Shorts',
    !caps.custodial && 'Self-custody',
  ].filter(Boolean) as string[];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, connected && styles.cardConnected, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{venue.name}</Text>
            {connected ? <Chip label="CONNECTED" tone="up" size="sm" /> : null}
            <MaturityChip venue={venue} />
          </View>
          <Text style={styles.blurb}>{venue.blurb}</Text>
        </View>
      </View>

      <View style={styles.featureRow}>
        {features.map((f) => (
          <View key={f} style={styles.feature}>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {venue.warning ? (
        <View style={styles.warning}>
          <ShieldIcon size={16} color={venue.maturity === 'experimental' ? colors.down : colors.gold} />
          <Text
            style={[styles.warningText, venue.maturity === 'experimental' && { color: colors.down }]}
            numberOfLines={4}
          >
            {venue.warning}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function MaturityChip({ venue }: { venue: VenueDescriptor }) {
  switch (venue.maturity) {
    case 'verified':
      return <Chip label="TESTED LIVE" tone="up" size="sm" />;
    case 'untested':
      return <Chip label="UNTESTED" tone="gold" size="sm" />;
    default:
      return <Chip label="EXPERIMENTAL" tone="down" size="sm" />;
  }
}

const styles = StyleSheet.create({
  intro: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
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
  cardConnected: {
    borderColor: colors.goldLine,
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontFamily: fonts.bold,
  },
  blurb: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    fontFamily: fonts.regular,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.md,
  },
  feature: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  featureText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  warning: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardLine,
  },
  warningText: {
    flex: 1,
    color: colors.gold,
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: fonts.regular,
  },
  footnote: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 18,
    marginTop: spacing.md,
    fontFamily: fonts.regular,
  },
});
