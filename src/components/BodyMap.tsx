import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Diagram } from '../data/types';
import { colors } from '../theme/colors';

const BODY_FILL = '#243456';
const BODY_STROKE = '#324975';

export function BodyMap({ diagram, color }: { diagram: Diagram; color: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{diagram.view === 'Front' ? '◐ Front view' : '◑ Back view'}</Text>
      </View>
      <Svg width={140} height={280} viewBox="0 0 200 400">
        {/* head */}
        <Ellipse cx={100} cy={32} rx={18} ry={20} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        {/* neck */}
        <Path d="M90,48 L110,48 L110,60 L90,60 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        {/* torso */}
        <Path
          d="M70,64 C68,90 74,120 80,140 C74,155 70,165 72,175 L128,175 C130,165 126,155 120,140 C126,120 132,90 130,64 Z"
          fill={BODY_FILL}
          stroke={BODY_STROKE}
          strokeWidth={1}
        />
        {/* arms */}
        <Ellipse cx={55} cy={98} rx={11} ry={34} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} transform="rotate(-12 55 98)" />
        <Ellipse cx={145} cy={98} rx={11} ry={34} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} transform="rotate(12 145 98)" />
        <Ellipse cx={44} cy={160} rx={9} ry={32} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} transform="rotate(-8 44 160)" />
        <Ellipse cx={156} cy={160} rx={9} ry={32} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} transform="rotate(8 156 160)" />
        <Ellipse cx={40} cy={196} rx={8} ry={12} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        <Ellipse cx={160} cy={196} rx={8} ry={12} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        {/* legs */}
        <Ellipse cx={85} cy={230} rx={17} ry={45} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        <Ellipse cx={115} cy={230} rx={17} ry={45} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        <Ellipse cx={85} cy={318} rx={13} ry={38} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        <Ellipse cx={115} cy={318} rx={13} ry={38} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        <Ellipse cx={83} cy={368} rx={12} ry={8} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />
        <Ellipse cx={117} cy={368} rx={12} ry={8} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={1} />

        {/* highlight(s) */}
        {diagram.highlights.map((h, i) => (
          <Ellipse key={i} cx={h.cx} cy={h.cy} rx={h.rx} ry={h.ry} fill={color + '99'} stroke={color} strokeWidth={2} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 12,
    marginBottom: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    marginLeft: 14,
    marginBottom: 4,
  },
  badgeText: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
