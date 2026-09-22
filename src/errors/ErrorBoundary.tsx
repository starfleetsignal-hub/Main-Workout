import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ShieldIcon } from '../components/icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { radius, spacing } from '../theme/layout';
import { recordCrash } from './crashLog';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors anywhere below it. Deliberately does not depend
 * on any app context (license, risk, engine) — if one of those is what
 * crashed, the fallback UI still has to render on its own.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    void recordCrash(error, info.componentStack ?? 'render');
  }

  reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    if (this.state.error) return <CrashScreen error={this.state.error} onReset={this.reset} />;
    return this.props.children;
  }
}

function CrashScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ShieldIcon size={32} color={colors.down} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          TradeRunner hit an unexpected error and stopped running. If a position was open, it is no longer being
          managed by this app until you restart — check your broker or exchange directly if you're unsure.
        </Text>
        <View style={styles.detailBox}>
          <Text style={styles.detailText} selectable>
            {error.message || String(error)}
          </Text>
        </View>
        <Pressable onPress={onReset} accessibilityRole="button" style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <Text style={styles.ctaText}>Restart</Text>
        </Pressable>
        <Text style={styles.hint}>A record of this was saved on this device — see Settings → Diagnostics.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBottom,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  detailBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardLine,
    padding: spacing.md,
    maxHeight: 140,
  },
  detailText: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
  },
  cta: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ctaText: {
    color: colors.onGold,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 11.5,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
});
