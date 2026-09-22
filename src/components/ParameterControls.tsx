import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/layout';

/**
 * A stepper rather than a slider: exact values matter when they control
 * real money, and a slider on a phone is hard to land on "0.75%".
 */
export function NumberSetting({
  label,
  help,
  value,
  min,
  max,
  step,
  suffix = '',
  decimals,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  const dp = decimals ?? (step < 1 ? String(step).split('.')[1]?.length ?? 2 : 0);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const display = value.toFixed(dp);

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        {help ? <Text style={styles.help}>{help}</Text> : null}
      </View>
      <View style={styles.stepper}>
        <StepButton label="−" onPress={() => onChange(clamp(value - step))} disabled={value <= min} />
        <Text style={styles.stepValue}>
          {display}
          {suffix}
        </Text>
        <StepButton label="+" onPress={() => onChange(clamp(value + step))} disabled={value >= max} />
      </View>
    </View>
  );
}

function StepButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const [held, setHeld] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase' : 'Decrease'}
      hitSlop={6}
      style={[styles.stepButton, held && !disabled && { backgroundColor: colors.accentSoft }, disabled && { opacity: 0.3 }]}
    >
      <Text style={styles.stepButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SwitchSetting({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        {help ? <Text style={styles.help}>{help}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.divider, true: colors.accentSoft }}
        thumbColor={value ? colors.accent : colors.textFaint}
      />
    </View>
  );
}

export function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.xl,
  },
  groupTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  groupBody: {
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
  rowText: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  help: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  stepButton: {
    width: 34,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  stepButtonText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  stepValue: {
    minWidth: 58,
    textAlign: 'center',
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
