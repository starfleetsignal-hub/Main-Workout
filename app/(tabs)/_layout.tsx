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
        // Every tab's header stays mounted at once (React Navigation only
        // tells them apart by z-index, not display), so a shared transparent
        // header showed every tab's title stacked in the same corner. Each
        // screen renders its own title in its own content instead — see
        // ScreenTitle — which disappears along with the rest of an unfocused
        // screen's output.
        headerShown: false,
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
