import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../src/theme/colors';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{symbol}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Desk', tabBarIcon: ({ focused }) => <TabIcon symbol="📈" focused={focused} /> }}
      />
      <Tabs.Screen
        name="positions"
        options={{ title: 'Positions', tabBarIcon: ({ focused }) => <TabIcon symbol="💼" focused={focused} /> }}
      />
      <Tabs.Screen
        name="news"
        options={{ title: 'News', tabBarIcon: ({ focused }) => <TabIcon symbol="📰" focused={focused} /> }}
      />
      <Tabs.Screen
        name="parameters"
        options={{ title: 'Rules', tabBarIcon: ({ focused }) => <TabIcon symbol="🎚️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon symbol="⚙️" focused={focused} /> }}
      />
    </Tabs>
  );
}
