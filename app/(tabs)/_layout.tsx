import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '课程',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="function"
        options={{
          title: '功能',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="square.grid.3x3" color={color} />,
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
