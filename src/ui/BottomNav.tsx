import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import type { StringKey } from '@/i18n/strings';

export interface BottomNavProps {
  active: string;
  onChange: (key: string) => void;
}

const ITEMS: { key: string; icon: IconName; labelKey: StringKey }[] = [
  { key: 'today', icon: 'home', labelKey: 'nav.today' },
  { key: 'schedule', icon: 'calendar', labelKey: 'nav.schedule' },
  { key: 'students', icon: 'users', labelKey: 'nav.students' },
  { key: 'finance', icon: 'wallet', labelKey: 'nav.finance' },
  { key: 'analytics', icon: 'chart', labelKey: 'nav.analytics' },
];

/** Web-only `backdropFilter` (not in RN's ViewStyle; react-native-web passes it through). */
type WebViewStyle = ViewStyle & { backdropFilter?: string };

const WEB_BLUR: WebViewStyle | undefined =
  Platform.OS === 'web' ? { backdropFilter: 'saturate(180%) blur(22px)' } : undefined;

/**
 * BottomNav — ported from the prototype's translucent tab bar
 * (`t+/components.jsx` → `BottomNav`): web blur `saturate(180%) blur(22px)`,
 * top hairline, active = primary + bold, inactive = stoneInactive.
 */
export function BottomNav({ active, onChange }: BottomNavProps) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.tabbar, borderTopColor: colors.hairline },
        WEB_BLUR,
      ]}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        const color = on ? colors.primary : colors.stoneInactive;
        return (
          <Pressable key={it.key} style={styles.tab} onPress={() => onChange(it.key)}>
            <Icon name={it.icon} size={24} sw={on ? 2 : 1.7} stroke={color} />
            <Text
              style={[styles.label, { color, fontWeight: on ? '600' : '500' }]}
              numberOfLines={1}>
              {t(it.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 9,
    paddingBottom: 24,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingTop: 2 },
  label: { fontSize: 10.5, letterSpacing: -0.1 },
});

export default BottomNav;
