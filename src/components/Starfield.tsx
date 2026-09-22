import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';

/**
 * The cosmic backdrop: a vertical gradient with a nebula bloom and a field of
 * stars. It sits behind everything and never intercepts touches.
 *
 * The stars are laid out once from a seeded generator so the sky does not
 * reshuffle on every render, and only two dim layers cross-fade, which keeps
 * it alive without costing a frame budget the trading UI needs.
 */
interface StarfieldProps {
  /** Number of stars. Lower it on dense screens. */
  count?: number;
  /** Set false to stop the twinkle, e.g. when reduced motion is preferred. */
  animate?: boolean;
}

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    // xorshift32: deterministic, and good enough for scattering dots.
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function Starfield({ count = 90, animate = true }: StarfieldProps) {
  const { width, height } = useWindowDimensions();
  const twinkle = useRef(new Animated.Value(0)).current;

  const stars = useMemo(() => {
    const rand = seededRandom(20260922);
    return Array.from({ length: count }, () => {
      const r = rand();
      return {
        x: rand() * 100,
        y: rand() * 100,
        // Most stars are small; a few are bright enough to notice.
        radius: r > 0.94 ? 1.9 : r > 0.75 ? 1.3 : 0.8,
        opacity: 0.25 + rand() * 0.6,
        layer: rand() > 0.5 ? 1 : 0,
      };
    });
  }, [count]);

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, twinkle]);

  const layerA = twinkle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  const layerB = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  const renderLayer = (layer: number) => (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      {stars
        .filter((s) => s.layer === layer)
        .map((s, i) => (
          <Circle
            key={i}
            cx={s.x}
            cy={s.y}
            // Counteract the non-uniform viewBox so stars stay round.
            r={(s.radius / width) * 100}
            fill="#FFFFFF"
            opacity={s.opacity}
          />
        ))}
    </Svg>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="nebula" cx="50%" cy="-6%" rx="85%" ry="55%">
            <Stop offset="0%" stopColor={colors.bgTop} stopOpacity="1" />
            <Stop offset="55%" stopColor={colors.bgMid} stopOpacity="1" />
            <Stop offset="100%" stopColor={colors.bgBottom} stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="bloom" cx="78%" cy="14%" rx="42%" ry="30%">
            <Stop offset="0%" stopColor="#5B2F8F" stopOpacity="0.30" />
            <Stop offset="100%" stopColor="#5B2F8F" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#nebula)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bloom)" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: animate ? layerA : 0.8 }]}>
        {renderLayer(0)}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: animate ? layerB : 0.8 }]}>
        {renderLayer(1)}
      </Animated.View>
      {/* A soft floor so text at the bottom of long screens stays legible. */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="floor" cx="50%" cy="108%" rx="90%" ry="42%">
            <Stop offset="0%" stopColor={colors.bgBottom} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={colors.bgBottom} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y={height * 0.55} width="100%" height={height * 0.45} fill="url(#floor)" />
      </Svg>
    </View>
  );
}
