import { Tabs } from 'expo-router';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon } from '@/ui';

export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.stoneInactive,
        tabBarStyle: { backgroundColor: colors.tabbar, borderTopColor: colors.hairline },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('nav.today'), tabBarIcon: ({ color, size }) => <Icon name="home" stroke={color} size={size} /> }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: t('nav.schedule'), tabBarIcon: ({ color, size }) => <Icon name="calendar" stroke={color} size={size} /> }}
      />
      <Tabs.Screen
        name="students"
        options={{ title: t('nav.students'), tabBarIcon: ({ color, size }) => <Icon name="users" stroke={color} size={size} /> }}
      />
      <Tabs.Screen
        name="finance"
        options={{ title: t('nav.finance'), tabBarIcon: ({ color, size }) => <Icon name="wallet" stroke={color} size={size} /> }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ title: t('nav.analytics'), tabBarIcon: ({ color, size }) => <Icon name="chart" stroke={color} size={size} /> }}
      />
    </Tabs>
  );
}
