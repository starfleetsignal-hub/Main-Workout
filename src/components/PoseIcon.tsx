import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { PoseId } from '../data/types';
import { POSES } from '../data/poses';

export function PoseIcon({ pose, color, size = 34 }: { pose: PoseId; color: string; size?: number }) {
  const spec = POSES[pose];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={spec.circle.cx} cy={spec.circle.cy} r={spec.circle.r} fill={color} />
      {spec.paths.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}
