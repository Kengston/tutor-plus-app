/**
 * «Оформление» (UI-v2 S15, spec 10 §10.1) — the theme sub-screen. Carries the Phase-3 theme
 * switcher (Авто / Светлая / Тёмная) verbatim; slice #34 upgrades it to preview cards + the
 * 19:00–7:00 «Авто» clock rule (ADR-0017) and adds «Цвета в расписании» / «Настройка главной».
 * Writes hit BOTH the context setter (instant re-theme) and the profile row (survives reload).
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/db/hooks';
import { updateProfile } from '@/db/mutations';
import { useT, type StringKey } from '@/i18n';
import { useTheme, useThemeMode, type ThemeMode } from '@/theme';
import { Icon, Segmented } from '@/ui';

/** Theme modes, in segmented order — values map to `useThemeMode().mode`. */
const THEMES: { key: ThemeMode; label: StringKey }[] = [
  { key: 'system', label: 'settings.themeSystem' },
  { key: 'light', label: 'settings.themeLight' },
  { key: 'dark', label: 'settings.themeDark' },
];

export default function AppearanceScreen() {
  const router = useRouter();
  const t = useT();
  const { colors } = useTheme();
  const { mode: themeMode, setMode } = useThemeMode();
  const profile = useProfile();

  /** Switch theme: context setter (instant) AND the row (survives reload) — ADR-0013 C. */
  const pickTheme = (next: ThemeMode) => {
    setMode(next);
    if (profile) void updateProfile(profile, { theme: next });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('settings.appearance')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.rowOnlyLabel, { color: colors.muted }]}>{t('settings.theme')}</Text>
        <Segmented
          tabs={THEMES.map((x) => t(x.label))}
          active={t(THEMES.find((x) => x.key === themeMode)?.label ?? 'settings.themeSystem')}
          onChange={(tab) => {
            const next = THEMES.find((x) => t(x.label) === tab);
            if (next) pickTheme(next.key);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Compact stack header — mirrors settings/index.tsx. */
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={title}>
        <Icon name="back" size={20} stroke={colors.heading} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.heading }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 6 },
  rowOnlyLabel: { fontSize: 13, fontWeight: '500', marginBottom: 2, paddingHorizontal: 2 },
  pressed: { opacity: 0.85 },
});
