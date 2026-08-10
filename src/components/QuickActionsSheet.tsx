/**
 * QuickActionsSheet — the FAB sheet on «Сегодня» (spec 04-today, 00-design-system §FAB;
 * prototype t+2/screens.jsx `QuickActionsSheet`): three quick actions — new lesson /
 * new student / new operation — instead of jumping straight to the lesson form.
 * Labels: canon third item is «Новая операция» (spec 04-today; existing `finance.newOp`).
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Sheet, Text, type IconName } from '@/ui';

type QuickTint = 'accent' | 'primary';

export function QuickActionsSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { colors, radius } = useTheme();
  const router = useRouter();

  const items: { icon: IconName; label: string; tint: QuickTint; route: '/lesson/new' | '/student/new' | '/finance/new' }[] = [
    { icon: 'calendar', label: t('quick.newLesson'), tint: 'accent', route: '/lesson/new' },
    { icon: 'users', label: t('students.new'), tint: 'primary', route: '/student/new' },
    { icon: 'wallet', label: t('finance.newOp'), tint: 'accent', route: '/finance/new' },
  ];

  return (
    <Sheet title={t('quick.title')} onClose={onClose}>
      <View style={styles.list}>
        {items.map((it) => (
          <Pressable
            key={it.route}
            onPress={() => {
              onClose();
              router.push(it.route);
            }}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: colors.stoneLight, borderRadius: radius.control },
              pressed && styles.pressed,
            ]}>
            <View
              style={[
                styles.bubble,
                { backgroundColor: it.tint === 'primary' ? colors.primaryLight : colors.accentSoft },
              ]}>
              <Icon
                name={it.icon}
                size={20}
                sw={1.8}
                stroke={it.tint === 'primary' ? colors.primaryDeep : colors.heading}
              />
            </View>
            <Text style={[styles.label, { color: colors.heading }]}>{it.label}</Text>
            <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11, paddingHorizontal: 12 },
  bubble: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
