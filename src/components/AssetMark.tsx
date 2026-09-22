import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { assetColor, colors } from '../theme/colors';

/**
 * A dimensional mark for each asset: a struck metal coin for crypto and an
 * embossed plate for equities.
 *
 * Drawn as SVG rather than shipped as artwork so it scales cleanly, weighs
 * nothing in the bundle, and covers any ticker rather than only the ones we
 * happened to have images for. The depth comes from a rim gradient, a
 * specular arc and a contact shadow, which is what makes it read as an object
 * instead of a flat circle.
 */

interface AssetMarkProps {
  symbol: string;
  size?: number;
}

/** Glyph paths for the coins worth drawing properly, on a 32x32 grid. */
const GLYPHS: Record<string, React.ReactNode> = {
  BTC: (
    <Path
      d="M13.2 7.4h2.0v2.3h1.5V7.4h2.0v2.4c2.4.2 4.0 1.2 4.2 3.3.15 1.5-.5 2.5-1.7 3.0 1.6.4 2.6 1.5 2.4 3.5-.25 2.5-2.2 3.5-4.9 3.6v2.4h-2.0v-2.4h-1.5v2.4h-2.0v-2.4H9.0v-2.1h1.3c.6 0 .8-.3.8-.8v-8.0c0-.5-.2-.8-.8-.8H9.0V9.8h4.2V7.4zm1.6 8.0h2.9c1.4 0 2.3-.5 2.3-1.7s-.9-1.7-2.3-1.7h-2.9v3.4zm0 6.0h3.4c1.6 0 2.6-.6 2.6-1.9s-1.0-1.9-2.6-1.9h-3.4v3.8z"
      fill="#FFFFFF"
    />
  ),
  ETH: (
    <G>
      <Path d="M16 5.5 L16 13.6 L22.6 16.6 Z" fill="#FFFFFF" opacity={0.75} />
      <Path d="M16 5.5 L9.4 16.6 L16 13.6 Z" fill="#FFFFFF" />
      <Path d="M16 21.0 L16 26.5 L22.6 17.9 Z" fill="#FFFFFF" opacity={0.75} />
      <Path d="M16 26.5 L16 21.0 L9.4 17.9 Z" fill="#FFFFFF" />
      <Path d="M16 19.7 L22.6 16.6 L16 13.6 Z" fill="#FFFFFF" opacity={0.45} />
      <Path d="M9.4 16.6 L16 19.7 L16 13.6 Z" fill="#FFFFFF" opacity={0.6} />
    </G>
  ),
  SOL: (
    <G fill="#FFFFFF">
      <Path d="M10.0 11.2a.7.7 0 0 1 .5-.2h12.0c.35 0 .5.4.28.64l-2.3 2.4a.7.7 0 0 1-.5.22H8.0c-.35 0-.5-.4-.27-.64l2.27-2.42z" />
      <Path d="M10.0 20.2a.7.7 0 0 1 .5-.2h12.0c.35 0 .5.4.28.64l-2.3 2.4a.7.7 0 0 1-.5.22H8.0c-.35 0-.5-.4-.27-.64l2.27-2.42z" opacity={0.85} />
      <Path d="M22.0 15.7a.7.7 0 0 0-.5-.2H9.5c-.35 0-.5.4-.28.64l2.3 2.4a.7.7 0 0 0 .5.22h12.0c.35 0 .5-.4.27-.64L22.0 15.7z" opacity={0.6} />
    </G>
  ),
  USDC: (
    <G fill="#FFFFFF">
      <Path d="M16.9 9.2v1.5c1.9.2 3.2 1.1 3.5 2.7h-2.2c-.2-.7-.8-1.1-1.9-1.1-1.2 0-1.9.5-1.9 1.2 0 .7.5 1.0 2.1 1.4 2.5.6 3.9 1.3 3.9 3.3 0 1.8-1.3 2.9-3.5 3.1v1.5h-1.8v-1.5c-2.1-.2-3.5-1.3-3.7-3.0h2.2c.2.8 1.0 1.3 2.3 1.3 1.3 0 2.0-.5 2.0-1.3 0-.7-.5-1.0-2.2-1.4-2.5-.6-3.8-1.4-3.8-3.3 0-1.7 1.3-2.7 3.2-2.9V9.2h1.8z" />
    </G>
  ),
};

function Ticker({ text, size }: { text: string; size: number }) {
  const label = text.slice(0, 4);
  return (
    <SvgText
      x={16}
      y={16 + size * 0.006 + 3.4}
      fontSize={label.length >= 4 ? 8.4 : label.length === 3 ? 10 : 12}
      fontWeight="700"
      fill="#FFFFFF"
      textAnchor="middle"
    >
      {label}
    </SvgText>
  );
}

export function AssetMark({ symbol, size = 40 }: AssetMarkProps) {
  const isCrypto = symbol.includes('/');
  const base = symbol.split('/')[0].toUpperCase();
  const palette = assetColor(symbol);
  const id = base.replace(/[^A-Z0-9]/g, '') || 'ASSET';

  if (!isCrypto) return <EquityPlate symbol={base} size={size} />;

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        {/* The coin face: lit from the top left. */}
        <RadialGradient id={`face-${id}`} cx="34%" cy="28%" r="78%">
          <Stop offset="0%" stopColor={palette.light} />
          <Stop offset="58%" stopColor={palette.base} />
          <Stop offset="100%" stopColor={palette.dark} />
        </RadialGradient>
        {/* The milled rim, bright at the top and shadowed at the bottom. */}
        <LinearGradient id={`rim-${id}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0%" stopColor={palette.light} stopOpacity="0.95" />
          <Stop offset="45%" stopColor={palette.base} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={palette.dark} stopOpacity="0.95" />
        </LinearGradient>
        <LinearGradient id={`gloss-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient id={`drop-${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Contact shadow grounds the coin against the card. */}
      <Ellipse cx="16" cy="29.4" rx="10.5" ry="2.2" fill={`url(#drop-${id})`} />

      <Circle cx="16" cy="16" r="15" fill={`url(#rim-${id})`} />
      <Circle cx="16" cy="16" r="13.2" fill={`url(#face-${id})`} />
      {/* Inner bevel. */}
      <Circle cx="16" cy="16" r="13.2" fill="none" stroke="#000000" strokeOpacity="0.18" strokeWidth="0.7" />

      <G>{GLYPHS[base] ?? <Ticker text={base} size={size} />}</G>

      {/* Specular highlight across the upper face. */}
      <Path d="M5.2 13.5a11.6 11.6 0 0 1 21.6 0 15 15 0 0 0-21.6 0z" fill={`url(#gloss-${id})`} />
      <Circle cx="16" cy="16" r="15" fill="none" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="0.6" />
    </Svg>
  );
}

/** Equities get a brushed plate rather than a coin. */
function EquityPlate({ symbol, size }: { symbol: string; size: number }) {
  const id = symbol.replace(/[^A-Z0-9]/g, '') || 'TICK';
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id={`plate-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#3C4574" />
          <Stop offset="50%" stopColor="#2A3157" />
          <Stop offset="100%" stopColor="#1A1F3C" />
        </LinearGradient>
        <LinearGradient id={`plateGloss-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.30" />
          <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient id={`plateDrop-${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#000000" stopOpacity="0.40" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Ellipse cx="16" cy="29.2" rx="10" ry="2" fill={`url(#plateDrop-${id})`} />
      <Rect x="1.5" y="2.5" width="29" height="26" rx="7.5" fill={`url(#plate-${id})`} />
      <Rect x="1.5" y="2.5" width="29" height="26" rx="7.5" fill="none" stroke={colors.cardLineStrong} strokeWidth="0.9" />
      <Rect x="3.2" y="4.2" width="25.6" height="11" rx="5.6" fill={`url(#plateGloss-${id})`} />
      <SvgText
        x="16"
        y="19.2"
        fontSize={symbol.length >= 5 ? 7.2 : symbol.length === 4 ? 8.4 : 10}
        fontWeight="700"
        fill={colors.text}
        textAnchor="middle"
      >
        {symbol.slice(0, 5)}
      </SvgText>
    </Svg>
  );
}
