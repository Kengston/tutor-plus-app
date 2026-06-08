import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMode, useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useTheme, useThemeMode } from '@/theme';
import { Icon, type IconName } from '@/ui';

/**
 * Phase-0 scaffold header: large title + DEV toggles for theme and dual-mode,
 * satisfying the Phase-0 DoD ("5 tabs with themes and a dual-mode switcher").
 * Replaced by the real RootHeader / settings flow in later phases.
 */
export function DevBar({ title }: { title: string }) {
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
        <Pressable onPress={cycle} style={[styles.pill, { backgroundColor: colors.stoneLight }]}>
          <Icon name={themeIcon} size={15} sw={1.8} stroke={colors.stone700} />
          <Text style={[styles.pillText, { color: colors.stone700 }]}>{themeLabel}</Text>
        </Pressable>
        <Pressable onPress={toggle} style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
          <Icon name="refresh" size={15} sw={1.8} stroke={colors.heading} />
          <Text style={[styles.pillText, { color: colors.heading }]}>{clientType}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="UI kit"
          onPress={() => router.push('/gallery')}
          style={[styles.iconBtn, { backgroundColor: colors.stoneLight }]}>
          <Icon name="grid" size={18} sw={1.8} stroke={colors.stone700} />
        </Pressable>
        <Pressable
          accessibilityLabel={t('auth.signOut')}
          onPress={signOut}
          style={[styles.iconBtn, { backgroundColor: colors.stoneLight }]}>
          <Icon name="back" size={18} sw={1.8} stroke={colors.stone700} />
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.heading }]}>{title}</Text>
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
