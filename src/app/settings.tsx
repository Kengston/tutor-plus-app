/**
 * Settings (ADR-0013 D) — the Phase-3-scoped profile & preferences screen. Replaces the
 * Phase-0 DevBar: «Профиль» (имя/деятельность/tz) · «Режим» (dual-mode) · «Оформление»
 * (тема) · «Уведомления» (lead-time + тумблеры + push-permission) + отложенные заглушки.
 *
 * Persistence is DB→context ONE-WAY (ADR-0013 C, lib/profile ProfileGate): every write updates
 * the `profiles` row via `updateProfile` AND — for theme/mode — the in-memory context setter
 * (`setMode`/`setClientType`) so the change is instant; there is no observe-back, so no cycle.
 * The profile row is read reactively; until it loads we render nothing (brief null splash).
 *
 * Shell mirrors finance/[id].tsx: a custom Header (this stack has headerShown:false) inside a
 * SafeAreaView; the body is a ScrollView. All strings via i18n (dual-mode resolves inside t());
 * all colours via theme tokens. The screen lives inside the root WebFrame — no width constraints.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProfileModel } from '@/db/models';
import { updateProfile } from '@/db/mutations';
import { useProfile } from '@/db/hooks';
import { useMode, useT, type Activity, type ClientType, type StringKey } from '@/i18n';
import { scheduler } from '@/lib/notifications';
import { useTheme, useThemeMode, type ThemeMode } from '@/theme';
import { Card, Chip, Icon, SectionLabel, Segmented, Sheet } from '@/ui';

/** Activities offered in the picker, in display order — labels resolve via i18n `activity.*`. */
const ACTIVITIES: { key: Activity; label: StringKey }[] = [
  { key: 'teacher', label: 'activity.teacher' },
  { key: 'psychologist', label: 'activity.psychologist' },
  { key: 'coach', label: 'activity.coach' },
  { key: 'mentor', label: 'activity.mentor' },
  { key: 'trainer', label: 'activity.trainer' },
];

/** Theme modes (Оформление), in segmented order — values map to `useThemeMode().mode`. */
const THEMES: { key: ThemeMode; label: StringKey }[] = [
  { key: 'system', label: 'settings.themeSystem' },
  { key: 'light', label: 'settings.themeLight' },
  { key: 'dark', label: 'settings.themeDark' },
];

/** Reminder lead-times in minutes (10 / 20 / 60 / 1440) — labels via i18n `lead.*`. */
const LEADS: { key: number; label: StringKey }[] = [
  { key: 10, label: 'lead.10' },
  { key: 20, label: 'lead.20' },
  { key: 60, label: 'lead.60' },
  { key: 1440, label: 'lead.1440' },
];

/** The four notification toggles — each bound to its own boolean profile field. */
const TOGGLES: { label: StringKey; field: 'notifLessons' | 'notifPayment' | 'notifSchedule' | 'notifSummary' }[] = [
  { label: 'settings.notifLessons', field: 'notifLessons' },
  { label: 'settings.notifPayment', field: 'notifPayment' },
  { label: 'settings.notifSchedule', field: 'notifSchedule' },
  { label: 'settings.notifSummary', field: 'notifSummary' },
];

/** Deferred sections (Ф4/Ф5) — shown disabled with a «Скоро» chip (ADR-0013 D). */
const DEFERRED: StringKey[] = ['settings.account', 'settings.backup', 'settings.support'];

export default function SettingsScreen() {
  const router = useRouter();
  const t = useT();
  const { colors, radius } = useTheme();

  // Reactive single-row profile (ADR-0013 C); undefined until `ensureProfile` has run.
  const profile = useProfile();
  // Dual-mode + theme context controls — written alongside the row so the change is instant.
  const { clientType, setClientType } = useMode();
  const { mode: themeMode, setMode } = useThemeMode();

  // Activity picker sheet visibility.
  const [activityPicker, setActivityPicker] = useState(false);
  // Local mirror of the editable name (so typing is smooth); persisted on every change.
  const [name, setName] = useState<string>(profile?.name ?? '');
  // Tracks a denied push request so we can surface the «отключены» hint (vs. the neutral CTA).
  const [pushAttemptedDenied, setPushAttemptedDenied] = useState(false);

  // Brief null splash until the profile row loads (Phase-0 parity; ProfileGate already gated launch).
  if (!profile) return null;

  /** Persist the name to the row on each keystroke (DB write is cheap; no debounce needed). */
  const onChangeName = (next: string) => {
    setName(next);
    void updateProfile(profile, { name: next });
  };

  /** Pick an activity → persist (non-lexical; only presets default clientType — ADR-0006). */
  const pickActivity = (activity: Activity) => {
    void updateProfile(profile, { activity });
    setActivityPicker(false);
  };

  /** Switch dual-mode lexicon: BOTH the context setter (instant) AND the row (survives reload). */
  const pickClientType = (next: ClientType) => {
    setClientType(next);
    void updateProfile(profile, { clientType: next });
  };

  /** Switch theme: BOTH `setMode` (instant re-theme) AND the row (survives reload). */
  const pickTheme = (next: ThemeMode) => {
    setMode(next);
    void updateProfile(profile, { theme: next });
  };

  /** Request OS notification permission; on grant flip the persisted flag (drives the state row). */
  const requestPush = async () => {
    const granted = await scheduler.requestPermission();
    if (granted) {
      setPushAttemptedDenied(false);
      void updateProfile(profile, { pushGranted: true });
    } else {
      setPushAttemptedDenied(true);
    }
  };

  const activityLabel = ACTIVITIES.find((a) => a.key === profile.activity)?.label ?? 'activity.teacher';

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('settings.title')} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* ── Профиль: имя · деятельность · часовой пояс ─────────────────────── */}
        <View>
          <SectionLabel>{t('settings.profile')}</SectionLabel>
          <Card style={styles.card}>
            {/* Имя — inline text input (persists on each change). */}
            <View style={styles.pickRow}>
              <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('settings.profileName')}</Text>
              <TextInput
                value={name}
                onChangeText={onChangeName}
                placeholder={t('settings.profileName')}
                placeholderTextColor={colors.stoneInactive}
                accessibilityLabel={t('settings.profileName')}
                style={[styles.textInput, { color: colors.heading }]}
              />
            </View>

            <Hairline />

            {/* Вид деятельности — opens a Sheet picker. */}
            <Pressable
              onPress={() => setActivityPicker(true)}
              style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}>
              <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('settings.activity')}</Text>
              <Text numberOfLines={1} style={[styles.rowValue, { color: colors.heading }]}>
                {t(activityLabel)}
              </Text>
              <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
            </Pressable>

            <Hairline />

            {/* Часовой пояс — read-only in Phase 3 (no picker; informational, ADR-0005). */}
            <View style={styles.pickRow}>
              <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('settings.tz')}</Text>
              <Text numberOfLines={1} style={[styles.rowValue, { color: colors.heading }]}>
                {profile.tz}
              </Text>
            </View>
          </Card>
        </View>

        {/* ── Режим (dual-mode) — Ученик ⇄ Клиент ───────────────────────────── */}
        <View>
          <SectionLabel>{t('settings.mode')}</SectionLabel>
          <Text style={[styles.hint, { color: colors.muted }]}>{t('settings.modeHint')}</Text>
          <Segmented
            tabs={[t('mode.student'), t('mode.client')]}
            active={clientType === 'Ученик' ? t('mode.student') : t('mode.client')}
            onChange={(tab) => pickClientType(tab === t('mode.student') ? 'Ученик' : 'Клиент')}
          />
        </View>

        {/* ── Оформление (тема) — Авто / Светлая / Тёмная ───────────────────── */}
        <View>
          <SectionLabel>{t('settings.appearance')}</SectionLabel>
          <Text style={[styles.rowOnlyLabel, { color: colors.muted }]}>{t('settings.theme')}</Text>
          <Segmented
            tabs={THEMES.map((x) => t(x.label))}
            active={t(THEMES.find((x) => x.key === themeMode)?.label ?? 'settings.themeSystem')}
            onChange={(tab) => {
              const next = THEMES.find((x) => t(x.label) === tab);
              if (next) pickTheme(next.key);
            }}
          />
        </View>

        {/* ── Уведомления: lead-time · тумблеры · push ──────────────────────── */}
        <View>
          <SectionLabel>{t('settings.notifications')}</SectionLabel>

          {/* Напоминать заранее — lead-time segmented (10 / 20 / 1 час / 1 день). */}
          <Text style={[styles.rowOnlyLabel, { color: colors.muted }]}>{t('settings.reminderLead')}</Text>
          <Segmented
            tabs={LEADS.map((x) => t(x.label))}
            active={t(LEADS.find((x) => x.key === profile.reminderLeadMin)?.label ?? 'lead.60')}
            onChange={(tab) => {
              const next = LEADS.find((x) => t(x.label) === tab);
              if (next) void updateProfile(profile, { reminderLeadMin: next.key });
            }}
          />

          {/* Четыре тумблера типов уведомлений (каждый — отдельное boolean-поле). */}
          <Card style={[styles.card, styles.togglesCard]}>
            {TOGGLES.map(({ label, field }, i) => (
              <View key={field}>
                {i > 0 ? <Hairline /> : null}
                <View style={styles.pickRow}>
                  <Text style={[styles.toggleLabel, { color: colors.heading }]} numberOfLines={1}>
                    {t(label)}
                  </Text>
                  <Toggle
                    value={profile[field]}
                    onToggle={() => void updateProfile(profile, { [field]: !profile[field] })}
                    label={t(label)}
                  />
                </View>
              </View>
            ))}
          </Card>
        </View>

        {/* ── Push-уведомления — permission request + state ─────────────────── */}
        <View>
          <SectionLabel>{t('settings.push')}</SectionLabel>
          {profile.pushGranted ? (
            <View style={[styles.pushState, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.row }]}>
              <Icon name="check" size={18} sw={1.9} stroke={colors.paid} />
              <Text style={[styles.pushStateLabel, { color: colors.heading }]}>{t('settings.pushGranted')}</Text>
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => void requestPush()}
                style={({ pressed }) => [
                  styles.pushBtn,
                  { backgroundColor: colors.primary, borderRadius: radius.field },
                  pressed && styles.pressed,
                ]}>
                <Icon name="bell" size={18} sw={1.8} stroke={colors.onTint} />
                <Text style={[styles.pushBtnLabel, { color: colors.onTint }]}>{t('settings.pushRequest')}</Text>
              </Pressable>
              {/* Surfaced only after an explicit denial — points the user at browser settings. */}
              {pushAttemptedDenied ? (
                <Text style={[styles.pushDenied, { color: colors.muted }]}>{t('settings.pushDenied')}</Text>
              ) : null}
            </>
          )}
        </View>

        {/* ── Отложено (Ф4/Ф5): аккаунт · бэкап · поддержка — disabled + «Скоро» ── */}
        <View>
          <Card style={styles.card}>
            {DEFERRED.map((key, i) => (
              <View key={key}>
                {i > 0 ? <Hairline /> : null}
                <View style={[styles.pickRow, styles.deferredRow]}>
                  <Text style={[styles.rowValue, styles.deferredLabel, { color: colors.stoneInactive }]} numberOfLines={1}>
                    {t(key)}
                  </Text>
                  <Chip tone="neutral">{t('settings.soon')}</Chip>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>

      {/* ── Activity picker — kit Sheet (mirrors finance/new.tsx student picker) ── */}
      {activityPicker ? (
        <Sheet title={t('settings.activity')} onClose={() => setActivityPicker(false)}>
          <Card>
            {ACTIVITIES.map(({ key, label }, i) => {
              const on = key === profile.activity;
              return (
                <View key={key}>
                  {i > 0 ? <Hairline /> : null}
                  <Pressable
                    onPress={() => pickActivity(key)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      on && { backgroundColor: colors.primaryVlight },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.optionLabel, { color: colors.heading }]}>{t(label)}</Text>
                    {on ? <Icon name="check" size={18} sw={2} stroke={colors.primary} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

/** Compact stack header (this stack has headerShown:false) — mirrors finance/[id].tsx. */
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

/** Themed pill toggle — hand-rolled to match the kit (no platform Switch); thumb slides on. */
function Toggle({ value, onToggle, label }: { value: boolean; onToggle: () => void; label: string }) {
  const { colors } = useTheme();
  return (
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
      <View style={[styles.thumb, { backgroundColor: value ? colors.onTint : colors.surface }, value ? styles.thumbOn : styles.thumbOff]} />
    </Pressable>
  );
}

/** Hairline divider — same token + thickness as finance/[id].tsx. */
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

  // section hints / standalone row labels (Segmented brings its own horizontal padding,
  // so these align to its inner track via a small negative-free left inset of 16 → 2).
  hint: { fontSize: 13, fontWeight: '500', marginTop: -4, marginBottom: 4, paddingHorizontal: 2 },
  rowOnlyLabel: { fontSize: 13, fontWeight: '500', marginBottom: 2, paddingHorizontal: 2 },

  // field cards (same metrics as finance/new.tsx)
  card: { paddingHorizontal: 14 },
  togglesCard: { marginTop: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowLabel: { fontSize: 14, fontWeight: '500', flexShrink: 0 },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600' },
  textInput: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  toggleLabel: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  hairline: { height: StyleSheet.hairlineWidth },

  // deferred (disabled) rows
  deferredRow: { opacity: 0.7 },
  deferredLabel: { textAlign: 'left', fontWeight: '500' },

  // themed pill toggle
  track: { width: 46, height: 28, borderRadius: 999, padding: 3, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11 },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },

  // push permission
  pushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  pushBtnLabel: { fontSize: 15, fontWeight: '600' },
  pushState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  pushStateLabel: { fontSize: 15, fontWeight: '600' },
  pushDenied: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 8, paddingHorizontal: 8 },

  // picker sheet rows
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  optionLabel: { fontSize: 15, fontWeight: '500' },

  pressed: { opacity: 0.85 },
});
