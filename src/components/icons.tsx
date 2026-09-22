import React from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';

/**
 * Drawn icons, replacing the emoji the first build used. Emoji render
 * differently on every platform and cannot take the app's colours; these
 * carry the gold accent and stay crisp at tab-bar size.
 */

export interface IconProps {
  size?: number;
  color?: string;
  /** Adds a soft fill behind the stroke, used for the active tab. */
  active?: boolean;
}

function Base({
  size = 24,
  children,
  viewBox = '0 0 24 24',
}: {
  size?: number;
  children: React.ReactNode;
  viewBox?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      {children}
    </Svg>
  );
}

/** Desk: a candlestick chart with a rising trace. */
export function DeskIcon({ size = 24, color = colors.textFaint, active }: IconProps) {
  return (
    <Base size={size}>
      <Defs>
        <LinearGradient id="deskFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={active ? 0.35 : 0.16} />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d="M3 17.5 L8.5 12 L12 14.5 L21 6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 17.5 L8.5 12 L12 14.5 L21 6 L21 21 L3 21 Z" fill="url(#deskFill)" />
      <Path d="M16.5 6 H21 V10.5" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

/** Positions: a briefcase with a clasp. */
export function PositionsIcon({ size = 24, color = colors.textFaint, active }: IconProps) {
  return (
    <Base size={size}>
      <Rect x="2.5" y="7" width="19" height="13" rx="3" stroke={color} strokeWidth="1.9" fill={active ? color : 'none'} fillOpacity={active ? 0.16 : 0} />
      <Path d="M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7" stroke={color} strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <Path d="M2.5 12.5h19" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Rect x="10.4" y="11" width="3.2" height="3" rx="1" fill={color} />
    </Base>
  );
}

/** News: a folded paper with rules of text. */
export function NewsIcon({ size = 24, color = colors.textFaint, active }: IconProps) {
  return (
    <Base size={size}>
      <Rect x="3" y="4.5" width="14.5" height="15" rx="2.6" stroke={color} strokeWidth="1.9" fill={active ? color : 'none'} fillOpacity={active ? 0.16 : 0} />
      <Path d="M17.5 9H19a2 2 0 0 1 2 2v6.2a2.3 2.3 0 0 1-4.6 0" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <Path d="M6.2 8.6h8.1M6.2 12h8.1M6.2 15.4h5.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Base>
  );
}

/** Rules: three sliders. */
export function RulesIcon({ size = 24, color = colors.textFaint }: IconProps) {
  return (
    <Base size={size}>
      <Path d="M5 4v6M5 14v6M12 4v3M12 11v9M19 4v9M19 17v3" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
      <Circle cx="5" cy="12" r="2.4" stroke={color} strokeWidth="1.9" fill={colors.card} />
      <Circle cx="12" cy="9" r="2.4" stroke={color} strokeWidth="1.9" fill={colors.card} />
      <Circle cx="19" cy="15" r="2.4" stroke={color} strokeWidth="1.9" fill={colors.card} />
    </Base>
  );
}

/** Settings: a gear. */
export function SettingsIcon({ size = 24, color = colors.textFaint, active }: IconProps) {
  return (
    <Base size={size}>
      <Path
        d="M12 2.9l1.7 2.3 2.8-.5.5 2.8 2.3 1.7-1.4 2.5 1.4 2.5-2.3 1.7-.5 2.8-2.8-.5L12 21.1l-1.7-2.3-2.8.5-.5-2.8L4.7 14.8 6.1 12.3 4.7 9.8l2.3-1.7.5-2.8 2.8.5L12 2.9z"
        stroke={color}
        strokeWidth="1.8"
        fill={active ? color : 'none'}
        fillOpacity={active ? 0.16 : 0}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="1.8" fill={colors.card} />
    </Base>
  );
}

/** The brand mark: a rocket trace climbing over a horizon. */
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <Base size={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="brandTrace" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor={colors.cyan} />
          <Stop offset="100%" stopColor={colors.gold} />
        </LinearGradient>
        <LinearGradient id="brandBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#B9C2E8" />
        </LinearGradient>
      </Defs>
      <Circle cx="32" cy="32" r="30" fill={colors.card} stroke={colors.cardLine} strokeWidth="1.5" />
      <Path d="M12 46 C22 46 26 30 34 22" stroke="url(#brandTrace)" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <G>
        <Path
          d="M46 14c-6 1-12 5-16 11l4.6 4.6C40.6 25.6 45 20 46 14z"
          fill="url(#brandBody)"
        />
        <Path d="M34.6 29.6 30 25l-3.2 5.4 4.4 1.2 1.2 4.4 5.4-3.2z" fill={colors.gold} opacity={0.9} />
        <Circle cx="39.5" cy="21.5" r="2.4" fill={colors.bgMid} />
      </G>
      <Circle cx="18" cy="18" r="1.5" fill="#FFFFFF" opacity="0.8" />
      <Circle cx="50" cy="44" r="1.2" fill="#FFFFFF" opacity="0.6" />
      <Circle cx="24" cy="11" r="1" fill="#FFFFFF" opacity="0.5" />
    </Base>
  );
}

/** A small lock, used on gated surfaces. */
export function LockIcon({ size = 18, color = colors.gold }: IconProps) {
  return (
    <Base size={size}>
      <Rect x="4.5" y="10.5" width="15" height="10" rx="3" stroke={color} strokeWidth="1.9" fill="none" />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={color} strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <Circle cx="12" cy="15.5" r="1.6" fill={color} />
    </Base>
  );
}

/** A shield, for the venue-warning banners. */
export function ShieldIcon({ size = 18, color = colors.gold }: IconProps) {
  return (
    <Base size={size}>
      <Path d="M12 2.8 20 6v6.2c0 4.6-3.3 7.9-8 9.1-4.7-1.2-8-4.5-8-9.1V6l8-3.2z" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      <Path d="M12 8.4v4.4M12 15.8v.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Base>
  );
}

/** A satellite dish, used for connection state. */
export function SignalIcon({ size = 18, color = colors.cyan }: IconProps) {
  return (
    <Base size={size}>
      <Path d="M4 20l7-7" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
      <Circle cx="11" cy="13" r="2.4" stroke={color} strokeWidth="1.8" fill="none" />
      <Path d="M13.6 10.4a5.6 5.6 0 0 1 0 0M14.6 8.2a8 8 0 0 1 1.2 1.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Path d="M15.2 6.2a10 10 0 0 1 2.6 2.6M17.4 4a13 13 0 0 1 3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </Base>
  );
}
