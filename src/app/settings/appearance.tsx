/**
 * «Оформление» (UI-v2 S16, spec 10 §10.1 + ADR-0017) — theme PREVIEW CARDS («День / Вечер /
 * Авто» with the «Авто» clock-rule caption), «Цвета в расписании» (the six categorical
 * student colours + where they appear) and «Настройка главной» (which optional Today blocks
 * are visible; required ones are locked). Theme writes hit BOTH the context setter (instant
 * re-theme) and the profile row (survives reload) — ADR-0013 C.
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/db/hooks';
import { updateProfile } from '@/db/mutations';
import { useT, type StringKey } from '@/i18n';
import { parseHomeBlocks, serializeHomeBlocks, type HomeBlock } from '@/lib/home-blocks';
import { useBack } from '@/lib/nav';
import { catColors, darkColors, lightColors, useTheme, useThemeMode, type CatColor, type ThemeMode } from '@/theme';
import { Card, Icon, SectionLabel, Text } from '@/ui';

/** The three theme cards, in display order (spec: День / Вечер / Авто). */
const THEME_CARDS: { key: ThemeMode; label: StringKey }[] = [
  { key: 'light', label: 'settings.themeLight' },
  { key: 'dark', label: 'settings.themeDark' },
  { key: 'system', label: 'settings.themeSystem' },
];

const CATS: CatColor[] = ['terracotta', 'slate', 'ochre', 'sage', 'rose', 'lavender'];

export default function AppearanceScreen() {
  const goBack = useBack();
  const t = useT();
  const { colors } = useTheme();
  const { mode: themeMode, setMode } = useThemeMode();
  const profile = useProfile();

  /** Switch theme: context setter (instant) AND the row (survives reload) — ADR-0013 C. */
  const pickTheme = (next: ThemeMode) => {
    setMode(next);
    if (profile) void updateProfile(profile, { theme: next });
  };

  const visibleBlocks = parseHomeBlocks(profile?.homeBlocks ?? null);
  const toggleBlock = (block: HomeBlock) => {
    if (!profile) return;
    const next = visibleBlocks.includes(block)
      ? visibleBlocks.filter((b) => b !== block)
      : [...visibleBlocks, block];
    void updateProfile(profile, { homeBlocks: serializeHomeBlocks(next) });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('settings.appearance')} onBack={() => goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Theme preview cards (spec: карточки-превью + подпись про «Авто») ── */}
        <View>
          <SectionLabel>{t('settings.theme')}</SectionLabel>
          <View style={styles.cardsRow}>
            {THEME_CARDS.map(({ key, label }) => {
              const on = key === themeMode;
              // «Авто» previews a half-day/half-evening split; the fixed cards preview their palette.
              const preview = key === 'light' ? [lightColors] : key === 'dark' ? [darkColors] : [lightColors, darkColors];
              return (
                <Pressable
                  key={key}
                  onPress={() => pickTheme(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.themeCard,
                    { borderColor: on ? colors.primary : colors.hairline, backgroundColor: colors.surface },
                    on && styles.themeCardOn,
                    pressed && styles.pressed,
                  ]}>
                  {/* Mini palette preview: bg swatch with a surface stripe + accent dot. */}
                  <View style={styles.previewRow}>
                    {preview.map((p, i) => (
                      <View key={i} style={[styles.preview, { backgroundColor: p.bg, borderColor: colors.hairline }]}>
                        <View style={[styles.previewSurface, { backgroundColor: p.surface }]} />
                        <View style={[styles.previewDot, { backgroundColor: p.accent }]} />
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.themeCardLabel, { color: on ? colors.heading : colors.body }]}>{t(label)}</Text>
                  {on ? <Icon name="check" size={15} sw={2.2} stroke={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: colors.muted }]}>{t('theme.autoHint')}</Text>
        </View>

        {/* ── «Цвета в расписании» — the single categorical palette + where it shows ── */}
        <View>
          <SectionLabel>{t('theme.scheduleColors')}</SectionLabel>
          <Card style={styles.colorsCard}>
            <View style={styles.swatches}>
              {CATS.map((cat) => (
                <View key={cat} style={styles.swatch}>
                  <View style={[styles.swatchAvatar, { backgroundColor: catColors[cat].bg }]}>
                    <View style={[styles.swatchDot, { backgroundColor: catColors[cat].accent }]} />
                  </View>
                </View>
              ))}
            </View>
            <Text style={[styles.whereSeen, { color: colors.muted }]}>{t('theme.whereSeen')}</Text>
          </Card>
        </View>

        {/* ── «Настройка главной» — optional Today blocks; required ones are locked ── */}
        <View>
          <SectionLabel>{t('home.customize')}</SectionLabel>
          <Text style={[styles.hint, { color: colors.muted }]}>{t('home.customizeHint')}</Text>
          <Card style={styles.blocksCard}>
            {/* Required — locked with a chip, no toggle. */}
            <LockedRow label={t('today.yourDay')} lockedLabel={t('home.required')} />
            <Hairline />
            <LockedRow label={t('home.blockNext')} lockedLabel={t('home.required')} />
            <Hairline />
            <BlockToggle
              label={t('home.blockNearest')}
              value={visibleBlocks.includes('nearest')}
              onToggle={() => toggleBlock('nearest')}
            />
            <Hairline />
            <BlockToggle
              label={t('home.blockTomorrow')}
              value={visibleBlocks.includes('tomorrow')}
              onToggle={() => toggleBlock('tomorrow')}
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A required block row — visible, but locked («Обязательный»). */
function LockedRow({ label, lockedLabel }: { label: string; lockedLabel: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.blockRow}>
      <Text style={[styles.blockLabel, { color: colors.heading }]}>{label}</Text>
      <Text style={[styles.lockedLabel, { color: colors.stoneInactive }]}>{lockedLabel}</Text>
    </View>
  );
}

/** An optional block row with the shared pill toggle. */
function BlockToggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.blockRow}>
      <Text style={[styles.blockLabel, { color: colors.heading }]}>{label}</Text>
      <Pressable
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        hitSlop={6}
        style={({ pressed }) => [
          styles.track,
          { backgroundColor: value ? colors.primary : colors.stoneLight },
          pressed && styles.pressed,
        ]}>
        <View
          style={[
            styles.thumb,
            { backgroundColor: value ? colors.onTint : colors.surface },
            value ? styles.thumbOn : styles.thumbOff,
          ]}
        />
      </Pressable>
    </View>
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

function Hairline() {
  const { colors } = useTheme();
  return <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />;
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
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 18 },

  // theme preview cards
  cardsRow: { flexDirection: 'row', gap: 10 },
  themeCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  themeCardOn: { borderWidth: 2 },
  previewRow: { flexDirection: 'row', gap: 4 },
  preview: {
    width: 34,
    height: 52,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    justifyContent: 'space-between',
  },
  previewSurface: { height: 18, borderRadius: 5 },
  previewDot: { width: 10, height: 10, borderRadius: 5, alignSelf: 'flex-end' },
  themeCardLabel: { fontSize: 13.5, fontWeight: '600' },
  hint: { fontSize: 13, fontWeight: '500', marginTop: 8, paddingHorizontal: 2, lineHeight: 18 },

  // schedule colours
  colorsCard: { paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatch: { alignItems: 'center' },
  swatchAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  swatchDot: { width: 14, height: 14, borderRadius: 7 },
  whereSeen: { fontSize: 12.5, fontWeight: '500', textAlign: 'center' },

  // home blocks
  blocksCard: { paddingHorizontal: 14 },
  blockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52 },
  blockLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  lockedLabel: { fontSize: 13, fontWeight: '500' },
  hairline: { height: StyleSheet.hairlineWidth },

  // pill toggle (mirrors notification-settings)
  track: { width: 46, height: 28, borderRadius: 14, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11 },
  thumbOn: { alignSelf: 'flex-end', marginRight: 3 },
  thumbOff: { alignSelf: 'flex-start', marginLeft: 3 },

  pressed: { opacity: 0.85 },
});
