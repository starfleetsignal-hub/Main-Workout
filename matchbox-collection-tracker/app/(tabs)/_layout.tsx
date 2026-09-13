import { router, Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { colors } from '../../src/theme/colors';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 19, opacity: focused ? 1 : 0.55 }}>{symbol}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bgElevated, borderTopColor: colors.divider },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon symbol="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ focused }) => <TabIcon symbol="🧰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wish List',
          tabBarIcon: ({ focused }) => <TabIcon symbol="❤️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon symbol="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ focused }) => <TabIcon symbol="➕" focused={focused} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/add');
          },
        }}
      />
    </Tabs>
  );
}
