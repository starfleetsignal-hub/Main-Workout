import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, ToggleChip } from '../../src/components/Chip';
import { NumberSetting, SettingGroup, SwitchSetting } from '../../src/components/ParameterControls';
import { useEngine } from '../../src/context/EngineContext';
import { PARAMETER_BOUNDS, PARAMETER_PRESETS } from '../../src/engine/parameters';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { radius, shared, spacing } from '../../src/theme/layout';

export default function ParametersScreen() {
  const insets = useSafeAreaInsets();
  const { parameters: p, updateParameters, resetParameters, snapshot } = useEngine();
  const [symbolInput, setSymbolInput] = useState('');

  const running = snapshot.status === 'running' || snapshot.status === 'starting';

  const addSymbol = () => {
    const raw = symbolInput.trim().toUpperCase();
    if (!raw) return;
    if (!/^[A-Z0-9.\-]{1,12}(\/[A-Z]{3,5})?$/.test(raw)) {
      Alert.alert('Not a valid symbol', 'Use a ticker like AAPL, or a crypto pair like BTC/USD.');
      return;
    }
    if (p.watchlist.includes(raw)) {
      setSymbolInput('');
      return;
    }
    updateParameters({ watchlist: [...p.watchlist, raw] });
    setSymbolInput('');
  };

  const removeSymbol = (s: string) => {
    if (snapshot.positions[s]) {
      Alert.alert('Position open', `Close the ${s} position before removing it from the watchlist.`);
      return;
    }
    updateParameters({ watchlist: p.watchlist.filter((x) => x !== s) });
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 56, paddingBottom: spacing.xxl }}>
      <Text style={styles.intro}>
        These rules bound everything the engine may do. Changes apply immediately, including to positions already open.
      </Text>

      <SettingGroup title="Presets">
        <View style={styles.presetRow}>
          {PARAMETER_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() =>
                Alert.alert(preset.name, preset.description, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Apply', onPress: () => updateParameters(preset.values) },
                ])
              }
              accessibilityRole="button"
              style={({ pressed }) => [styles.preset, pressed && { borderColor: colors.gold }]}
            >
              <Text style={styles.presetName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {preset.name}
              </Text>
              <Text style={styles.presetDesc} numberOfLines={3}>
                {preset.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </SettingGroup>

      <SettingGroup title="Watchlist">
        <View style={styles.symbolBox}>
          <View style={styles.symbolWrap}>
            {p.watchlist.map((s) => (
              <Pressable
                key={s}
                onPress={() => removeSymbol(s)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${s}`}
                style={({ pressed }) => [styles.symbolChip, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.symbolChipText}>{s}</Text>
                <Text style={styles.symbolChipX}>×</Text>
              </Pressable>
            ))}
            {p.watchlist.length === 0 ? <Text style={styles.hint}>Add at least one symbol.</Text> : null}
          </View>
          <View style={styles.addRow}>
            <TextInput
              value={symbolInput}
              onChangeText={setSymbolInput}
              onSubmitEditing={addSymbol}
              placeholder="AAPL or BTC/USD"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              style={[shared.input, styles.addInput]}
              accessibilityLabel="Add symbol"
            />
            <Pressable
              onPress={addSymbol}
              accessibilityRole="button"
              style={({ pressed }) => [shared.button, styles.addButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={shared.buttonText}>Add</Text>
            </Pressable>
          </View>
        </View>
        <SwitchSetting
          label="Trade stocks"
          help="Regular-hours equities from your watchlist."
          value={p.tradeStocks}
          onChange={(v) => updateParameters({ tradeStocks: v })}
        />
        <SwitchSetting
          label="Trade crypto"
          help="Crypto pairs trade around the clock, including weekends."
          value={p.tradeCrypto}
          onChange={(v) => updateParameters({ tradeCrypto: v })}
        />
      </SettingGroup>

      <SettingGroup title="Size and exposure">
        <NumberSetting
          label="Risk per trade"
          help="Share count is sized so a stop-out costs about this much of your equity."
          value={p.riskPerTradePct}
          {...PARAMETER_BOUNDS.riskPerTradePct}
          step={PARAMETER_BOUNDS.riskPerTradePct.step!}
          suffix="%"
          onChange={(v) => updateParameters({ riskPerTradePct: v })}
        />
        <NumberSetting
          label="Max position size"
          help="Cap on any single position as a share of equity."
          value={p.maxPositionPct}
          {...PARAMETER_BOUNDS.maxPositionPct}
          step={PARAMETER_BOUNDS.maxPositionPct.step!}
          suffix="%"
          onChange={(v) => updateParameters({ maxPositionPct: v })}
        />
        <NumberSetting
          label="Max open positions"
          value={p.maxOpenPositions}
          {...PARAMETER_BOUNDS.maxOpenPositions}
          step={1}
          onChange={(v) => updateParameters({ maxOpenPositions: v })}
        />
        <SwitchSetting
          label="Fractional shares"
          help="Allow fractional stock quantities. Crypto is always fractional."
          value={p.fractionalShares}
          onChange={(v) => updateParameters({ fractionalShares: v })}
        />
      </SettingGroup>

      <SettingGroup title="Circuit breakers">
        <NumberSetting
          label="Daily loss limit"
          help="Hitting this closes everything and halts trading until you resume it."
          value={p.maxDailyLossPct}
          {...PARAMETER_BOUNDS.maxDailyLossPct}
          step={PARAMETER_BOUNDS.maxDailyLossPct.step!}
          suffix="%"
          onChange={(v) => updateParameters({ maxDailyLossPct: v })}
        />
        <NumberSetting
          label="Max trades per day"
          value={p.maxDailyTrades}
          {...PARAMETER_BOUNDS.maxDailyTrades}
          step={1}
          onChange={(v) => updateParameters({ maxDailyTrades: v })}
        />
      </SettingGroup>

      <SettingGroup title="Exits">
        <NumberSetting
          label="Stop loss"
          value={p.stopLossPct}
          {...PARAMETER_BOUNDS.stopLossPct}
          step={PARAMETER_BOUNDS.stopLossPct.step!}
          suffix="%"
          onChange={(v) => updateParameters({ stopLossPct: v })}
        />
        <NumberSetting
          label="Take profit"
          value={p.takeProfitPct}
          {...PARAMETER_BOUNDS.takeProfitPct}
          step={PARAMETER_BOUNDS.takeProfitPct.step!}
          suffix="%"
          onChange={(v) => updateParameters({ takeProfitPct: v })}
        />
        <NumberSetting
          label="Trailing stop"
          help="Locks in gains once price has moved this far your way. 0 disables it."
          value={p.trailingStopPct}
          {...PARAMETER_BOUNDS.trailingStopPct}
          step={PARAMETER_BOUNDS.trailingStopPct.step!}
          suffix="%"
          onChange={(v) => updateParameters({ trailingStopPct: v })}
        />
        <NumberSetting
          label="Max hold time"
          help="Day-trader discipline: close a position that stops working. 0 disables it."
          value={p.maxHoldMinutes}
          {...PARAMETER_BOUNDS.maxHoldMinutes}
          step={5}
          suffix="m"
          onChange={(v) => updateParameters({ maxHoldMinutes: v })}
        />
        <SwitchSetting
          label="Exit on trend break"
          help="Close when the fast EMA crosses back against the position."
          value={p.exitOnTrendBreak}
          onChange={(v) => updateParameters({ exitOnTrendBreak: v })}
        />
        <NumberSetting
          label="Cooldown after exit"
          help="Blocks re-entering the same symbol straight away."
          value={p.cooldownMinutes}
          {...PARAMETER_BOUNDS.cooldownMinutes}
          step={1}
          suffix="m"
          onChange={(v) => updateParameters({ cooldownMinutes: v })}
        />
      </SettingGroup>

      <SettingGroup title="Entry signal">
        <NumberSetting
          label="Minimum score"
          help="The composite score out of 100 a symbol must reach to be traded."
          value={p.minSignalScore}
          {...PARAMETER_BOUNDS.minSignalScore}
          step={1}
          onChange={(v) => updateParameters({ minSignalScore: v })}
        />
        <NumberSetting
          label="Volume confirmation"
          help="Last bar's volume as a multiple of the 20-bar average."
          value={p.minVolumeMultiple}
          {...PARAMETER_BOUNDS.minVolumeMultiple}
          step={PARAMETER_BOUNDS.minVolumeMultiple.step!}
          suffix="x"
          onChange={(v) => updateParameters({ minVolumeMultiple: v })}
        />
        <NumberSetting
          label="RSI floor"
          value={p.rsiMin}
          {...PARAMETER_BOUNDS.rsiMin}
          step={1}
          onChange={(v) => updateParameters({ rsiMin: v })}
        />
        <NumberSetting
          label="RSI ceiling"
          help="Above this, the move is treated as overbought and scores poorly."
          value={p.rsiMax}
          {...PARAMETER_BOUNDS.rsiMax}
          step={1}
          onChange={(v) => updateParameters({ rsiMax: v })}
        />
        <SwitchSetting
          label="Allow short selling"
          help="Shorts apply to stocks only, and need a margin account."
          value={p.allowShorts}
          onChange={(v) => updateParameters({ allowShorts: v })}
        />
      </SettingGroup>

      <SettingGroup title="News">
        <NumberSetting
          label="Lookback window"
          help="How far back headlines count toward a symbol's sentiment."
          value={p.newsLookbackMinutes}
          {...PARAMETER_BOUNDS.newsLookbackMinutes}
          step={5}
          suffix="m"
          onChange={(v) => updateParameters({ newsLookbackMinutes: v })}
        />
        <NumberSetting
          label="Minimum sentiment"
          help="Entries need sentiment at or above this, in the trade's direction."
          value={p.newsMinSentiment}
          {...PARAMETER_BOUNDS.newsMinSentiment}
          step={0.05}
          decimals={2}
          onChange={(v) => updateParameters({ newsMinSentiment: v })}
        />
        <NumberSetting
          label="Veto level"
          help="Sentiment this bad blocks entries and closes an open position."
          value={p.newsVetoSentiment}
          {...PARAMETER_BOUNDS.newsVetoSentiment}
          step={0.05}
          decimals={2}
          onChange={(v) => updateParameters({ newsVetoSentiment: v })}
        />
        <SwitchSetting
          label="Require a headline"
          help="Only trade symbols with recent news. Stricter, and far fewer trades."
          value={p.requireNewsConfirmation}
          onChange={(v) => updateParameters({ requireNewsConfirmation: v })}
        />
      </SettingGroup>

      <SettingGroup title="Session">
        <SwitchSetting
          label="Regular hours only"
          help="Keeps stock trading inside the regular session."
          value={p.stockSessionOnly}
          onChange={(v) => updateParameters({ stockSessionOnly: v })}
        />
        <NumberSetting
          label="Flatten before close"
          help="Close stock positions this many minutes before the bell."
          value={p.flattenBeforeCloseMinutes}
          {...PARAMETER_BOUNDS.flattenBeforeCloseMinutes}
          step={1}
          suffix="m"
          onChange={(v) => updateParameters({ flattenBeforeCloseMinutes: v })}
        />
        <NumberSetting
          label="Skip the open"
          help="Avoid the opening auction's noise."
          value={p.skipOpeningMinutes}
          {...PARAMETER_BOUNDS.skipOpeningMinutes}
          step={1}
          suffix="m"
          onChange={(v) => updateParameters({ skipOpeningMinutes: v })}
        />
      </SettingGroup>

      {running ? (
        <View style={styles.liveNote}>
          <Chip label="LIVE" tone="up" size="sm" />
          <Text style={styles.liveText}>The engine is running. Edits take effect on the next evaluation.</Text>
        </View>
      ) : null}

      <Pressable
        onPress={() =>
          Alert.alert('Reset to defaults?', 'Every rule returns to its shipped value.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: resetParameters },
          ])
        }
        accessibilityRole="button"
        style={({ pressed }) => [shared.buttonGhost, pressed && { opacity: 0.7 }]}
      >
        <Text style={shared.buttonGhostText}>Reset to defaults</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.xl,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  preset: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.cardRaised,
  },
  presetName: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  presetDesc: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  symbolBox: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardLine,
  },
  symbolWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  symbolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  symbolChipText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  symbolChipX: {
    color: colors.gold,
    fontSize: 14,
    fontFamily: fonts.bold,
    opacity: 0.7,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 12,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addInput: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  addButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  liveNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  liveText: {
    color: colors.textFaint,
    fontSize: 12,
    flex: 1,
  },
});
