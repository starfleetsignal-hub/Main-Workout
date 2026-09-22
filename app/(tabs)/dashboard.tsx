import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityRow } from '../../src/components/ActivityRow';
import { Chip } from '../../src/components/Chip';
import { StatTile } from '../../src/components/StatTile';
import { SymbolRow } from '../../src/components/SymbolRow';
import { useCredentials } from '../../src/context/CredentialsContext';
import { useEngine } from '../../src/context/EngineContext';
import { fmtSigned } from '../../src/engine/engine';
import { colors, pnlColor, statusColors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { radius, shared, spacing } from '../../src/theme/layout';

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { credentials, refreshAccount } = useCredentials();
  const { snapshot, parameters, start, stop, resume, flattenAll } = useEngine();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const running = snapshot.status === 'running' || snapshot.status === 'starting';
  const equity = snapshot.account?.equity ?? 0;
  const dayPnl = snapshot.account ? snapshot.account.equity - snapshot.account.lastEquity : 0;
  const dayPct = snapshot.account?.lastEquity ? (dayPnl / snapshot.account.lastEquity) * 100 : 0;
  const openCount = Object.keys(snapshot.positions).length;

  const openPnl = useMemo(
    () =>
      Object.values(snapshot.positions).reduce((sum, p) => {
        const px = snapshot.symbols[p.symbol]?.lastPrice || p.entryPrice;
        return sum + (px - p.entryPrice) * (p.side === 'long' ? 1 : -1) * p.qty;
      }, 0),
    [snapshot.positions, snapshot.symbols]
  );

  const watched = useMemo(
    () => parameters.watchlist.map((s) => snapshot.symbols[s]).filter(Boolean),
    [parameters.watchlist, snapshot.symbols]
  );

  const onToggle = useCallback(async () => {
    setBusy(true);
    try {
      if (running) await stop(false);
      else if (snapshot.status === 'halted') await resume();
      else await start();
    } finally {
      setBusy(false);
    }
  }, [running, snapshot.status, start, stop, resume]);

  const onFlatten = useCallback(() => {
    if (openCount === 0) return;
    Alert.alert('Close all positions?', `This sends market orders to close ${openCount} open position(s) right now.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close all', style: 'destructive', onPress: () => void flattenAll() },
    ]);
  }, [openCount, flattenAll]);

  if (!credentials) {
    return (
      <View style={[shared.screen, styles.empty, { paddingTop: insets.top + 56 }]}>
        <Text style={styles.emptyTitle}>Connect a venue</Text>
        <Text style={styles.emptyBody}>
          TradeRunner trades through an account you already own — Alpaca, Coinbase, Robinhood, Uphold or a Solana
          wallet through Jupiter. Add your keys to get live data and start the engine. Paper mode is the default where
          the venue offers one.
        </Text>
        <Pressable
          onPress={() => router.push('/venues')}
          accessibilityRole="button"
          style={({ pressed }) => [shared.button, { marginTop: spacing.xl }, pressed && { opacity: 0.85 }]}
        >
          <Text style={shared.buttonText}>Choose a venue</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.textMuted}
          onRefresh={async () => {
            setRefreshing(true);
            await refreshAccount();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.statusBar}>
        <View style={shared.row}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[snapshot.status] ?? colors.textFaint }]} />
          <Text style={styles.statusText}>
            {snapshot.status.toUpperCase()} · {snapshot.statusDetail}
          </Text>
        </View>
        <View style={styles.streamChips}>
          <Chip label={`STK ${snapshot.streams.stocks}`} tone={toneFor(snapshot.streams.stocks)} size="sm" />
          <Chip label={`CRY ${snapshot.streams.crypto}`} tone={toneFor(snapshot.streams.crypto)} size="sm" />
          <Chip label={`NEWS ${snapshot.streams.news}`} tone={toneFor(snapshot.streams.news)} size="sm" />
        </View>
      </View>

      <View style={styles.tiles}>
        <StatTile
          label="Equity"
          value={equity ? `$${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
          sub={credentials.mode === 'paper' ? 'paper account' : 'live account'}
        />
        <StatTile
          label="Day P&L"
          value={snapshot.account ? fmtSigned(dayPnl) : '—'}
          sub={snapshot.account ? `${fmtSigned(dayPct)}%` : undefined}
          valueColor={pnlColor(dayPnl)}
        />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Open" value={String(openCount)} sub={`max ${parameters.maxOpenPositions}`} />
        <StatTile label="Unrealized" value={openCount ? fmtSigned(openPnl) : '—'} valueColor={pnlColor(openPnl)} />
        <StatTile
          label="Trades"
          value={String(snapshot.tradesToday)}
          sub={`cap ${parameters.maxDailyTrades}`}
        />
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={onToggle}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            shared.button,
            styles.mainButton,
            running && { backgroundColor: colors.down },
            snapshot.status === 'halted' && { backgroundColor: colors.warn },
            (busy || pressed) && { opacity: 0.75 },
          ]}
        >
          <Text style={shared.buttonText}>
            {running ? 'Stop engine' : snapshot.status === 'halted' ? 'Resume after halt' : 'Start engine'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onFlatten}
          disabled={openCount === 0}
          accessibilityRole="button"
          style={({ pressed }) => [
            shared.buttonGhost,
            styles.flattenButton,
            openCount === 0 && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[shared.buttonGhostText, { color: colors.down }]}>Flatten</Text>
        </Pressable>
      </View>

      {snapshot.status === 'halted' ? (
        <View style={styles.haltBanner}>
          <Text style={styles.haltText}>
            Trading halted: the daily loss limit of {parameters.maxDailyLossPct}% was reached. Positions were closed.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionHeader}>Watchlist</Text>
      <View style={styles.list}>
        {watched.length === 0 ? (
          <Text style={styles.placeholder}>No symbols. Add some under Rules.</Text>
        ) : (
          watched.map((s) => (
            <SymbolRow
              key={s.symbol}
              state={s}
              signal={snapshot.signals[s.symbol]}
              position={snapshot.positions[s.symbol]}
              onPress={() => router.push(`/symbol/${encodeURIComponent(s.symbol)}`)}
            />
          ))
        )}
      </View>

      <Text style={styles.sectionHeader}>Activity</Text>
      <View style={styles.list}>
        {snapshot.activity.length === 0 ? (
          <Text style={styles.placeholder}>Nothing yet. Start the engine to see decisions as they happen.</Text>
        ) : (
          snapshot.activity.slice(0, 40).map((e) => <ActivityRow key={e.id} event={e} />)
        )}
      </View>
    </ScrollView>
  );
}

function toneFor(status: string): 'up' | 'warn' | 'down' | 'neutral' {
  if (status === 'connected') return 'up';
  if (status === 'connecting' || status === 'reconnecting') return 'warn';
  if (status === 'error') return 'down';
  return 'neutral';
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.bold,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
  statusBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.semibold,
    flex: 1,
  },
  streamChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  mainButton: {
    flex: 1,
  },
  flattenButton: {
    borderColor: colors.down,
    minWidth: 104,
  },
  haltBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.downSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.down,
  },
  haltText: {
    color: colors.down,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  list: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    overflow: 'hidden',
  },
  placeholder: {
    color: colors.textFaint,
    fontSize: 13,
    padding: spacing.lg,
    lineHeight: 19,
  },
});
