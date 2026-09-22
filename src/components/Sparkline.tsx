import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { colors } from '../theme/colors';

/** A minimal closing-price sparkline. No axes, no labels — it is a glance, not a chart. */
export function Sparkline({
  values,
  width = 88,
  height = 28,
  color,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const { d, stroke, baselineY } = useMemo(() => {
    const pts = values.filter((v) => Number.isFinite(v));
    if (pts.length < 2) return { d: '', stroke: colors.textFaint, baselineY: height / 2 };
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const stepX = width / (pts.length - 1);
    const y = (v: number) => height - ((v - min) / range) * (height - 2) - 1;
    const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const up = pts[pts.length - 1] >= pts[0];
    return { d: path, stroke: color ?? (up ? colors.up : colors.down), baselineY: y(pts[0]) };
  }, [values, width, height, color]);

  if (!d) return <View style={{ width, height }} />;

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={baselineY} x2={width} y2={baselineY} stroke={colors.divider} strokeWidth={1} strokeDasharray="2 3" />
      <Path d={d} stroke={stroke} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
