import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { DeskIcon, NewsIcon, PositionsIcon, RulesIcon, SettingsIcon } from '../../src/components/icons';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerTransparent: true,
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 19 },
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          // A glass shelf over the starfield rather than a solid bar.
          backgroundColor: Platform.OS === 'web' ? colors.card : colors.scrim,
          borderTopColor: colors.cardLine,
          borderTopWidth: StyleSheet.hairlineWidth,
          position: 'absolute',
          elevation: 0,
        },
        tabBarBackground: () => null,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: fonts.semibold, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Desk',
          tabBarIcon: ({ color, focused }) => <DeskIcon size={23} color={String(color)} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="positions"
        options={{
          title: 'Positions',
          tabBarIcon: ({ color, focused }) => <PositionsIcon size={23} color={String(color)} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color, focused }) => <NewsIcon size={23} color={String(color)} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="parameters"
        options={{
          title: 'Rules',
          tabBarIcon: ({ color }) => <RulesIcon size={23} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => <SettingsIcon size={23} color={String(color)} active={focused} />,
        }}
      />
    </Tabs>
  );
}
