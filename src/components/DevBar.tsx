import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMode, useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useTheme, useThemeMode } from '@/theme';
import { Icon, type IconName } from '@/ui';

/**
 * Dev-only utility strip (`__DEV__`): quick theme + dual-mode toggles, UI-kit, sign-out.
 * The real header (title + bell + avatar) is `AppHeader`; persisted theme/mode controls live
 * in the Settings screen (ADR-0013). Kept for dev ergonomics only — not shipped in production.
 */
export function DevBar() {
  const { colors } = useTheme();
  const { mode: themeMode, cycle } = useThemeMode();
  const { clientType, toggle } = useMode();
  const { signOut } = useAuth();
  const t = useT();
  const router = useRouter();

  const themeIcon: IconName = themeMode === 'dark' ? 'moon' : themeMode === 'light' ? 'sun' : 'refresh';
  const themeLabel =
    themeMode === 'dark' ? t('dev.themeDark') : themeMode === 'light' ? t('dev.themeLight') : t('dev.themeSystem');

  return (
    <View style={styles.header}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.themeMode')}
          onPress={cycle}
          style={[styles.pill, { backgroundColor: colors.stoneLight }]}>
          <Icon name={themeIcon} size={15} sw={1.8} stroke={colors.stone700} />
          <Text style={[styles.pillText, { color: colors.stone700 }]}>{themeLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.clientMode')}
          onPress={toggle}
          style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
          <Icon name="refresh" size={15} sw={1.8} stroke={colors.heading} />
          <Text style={[styles.pillText, { color: colors.heading }]}>{clientType}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.uiKit')}
          hitSlop={5}
          onPress={() => router.push('/gallery')}
          style={[styles.iconBtn, { backgroundColor: colors.stoneLight }]}>
          <Icon name="grid" size={18} sw={1.8} stroke={colors.stone700} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.signOut')}
          hitSlop={5}
          onPress={signOut}
          style={[styles.iconBtn, { backgroundColor: colors.stoneLight }]}>
          <Icon name="back" size={18} sw={1.8} stroke={colors.stone700} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minHeight: 38 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 12.5, fontWeight: '600' },
  iconBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 6, fontSize: 30, fontWeight: '600', letterSpacing: -0.6 },
});
