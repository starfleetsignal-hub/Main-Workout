import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { downsampleEquity } from '../engine/analytics';
import type { EquityPoint } from '../engine/types';
import { colors } from '../theme/colors';

/**
 * A filled equity curve, in the same restrained style as the watchlist
 * sparkline but sized for its own card. Colour follows the net direction
 * over the visible window, same convention as everywhere else in the app.
 */
export function EquityCurve({
  history,
  width = 320,
  height = 120,
}: {
  history: EquityPoint[];
  width?: number;
  height?: number;
}) {
  const { linePath, fillPath, up } = useMemo(() => {
    const points = downsampleEquity(history, 100).filter((p) => Number.isFinite(p.equity));
    if (points.length < 2) return { linePath: '', fillPath: '', up: true };

    const values = points.map((p) => p.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || Math.max(1, max * 0.01);
    const stepX = width / (points.length - 1);
    const y = (v: number) => height - ((v - min) / range) * (height - 8) - 4;

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(2)},${y(p.equity).toFixed(2)}`).join(' ');
    const fill = `${line} L${width},${height} L0,${height} Z`;
    return { linePath: line, fillPath: fill, up: values[values.length - 1] >= values[0] };
  }, [history, width, height]);

  if (!linePath) {
    return <View style={{ width, height }} />;
  }

  const stroke = up ? colors.up : colors.down;
  const gradientId = up ? 'equityFillUp' : 'equityFillDown';

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <Stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill={`url(#${gradientId})`} />
      <Path d={linePath} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
