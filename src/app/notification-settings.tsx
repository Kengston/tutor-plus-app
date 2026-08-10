import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/db/hooks';
import { updateProfile } from '@/db/mutations';
import { useT, type StringKey } from '@/i18n';
import { useBack } from '@/lib/nav';
import { scheduler } from '@/lib/notifications';
import { useTheme } from '@/theme';
import { Card, Icon, SectionLabel, Segmented, Text } from '@/ui';

/**
 * Notification settings (spec 09 §9.3) — opened from the feed header. «Включить уведомления»
 * is the MASTER switch: off silences the whole derived feed AND the OS scheduler (the gate
 * lives in buildFeed/planReminders, not here). «Уведомлять о долгах» is SEPARATE from payment
 * notifications. v8 columns are nullable — null reads as enabled (see schema.ts), so we always
 * WRITE explicit booleans. All rows persist straight to the single profiles row.
 */

/** Lead-time quick-picks — same set as the general settings screen (ADR-0013). */
const LEADS: { key: number; label: StringKey }[] = [
  { key: 10, label: 'lead.10' },
  { key: 20, label: 'lead.20' },
  { key: 60, label: 'lead.60' },
  { key: 1440, label: 'lead.1440' },
];

export default function NotificationSettingsScreen() {
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();
  const profile = useProfile();

  // Tracks a denied push request so we can surface the «отключены» hint (vs. the neutral CTA).
  // Re-homed from the old flat settings screen (review fix S15 — the split had dropped the app's
  // ONLY UI path to OS notification permission).
  const [pushAttemptedDenied, setPushAttemptedDenied] = useState(false);

  if (!profile) return null; // profile row is get-or-created on launch (ProfileGate)

  // Null (migrated v8 rows) reads as TRUE — mirror reminderPrefsOf's rule.
  const enabled = profile.notifEnabled !== false;
  const debts = profile.notifDebts !== false;

  /** Request OS notification permission; on grant flip the persisted flag. */
  const requestPush = async () => {
    const granted = await scheduler.requestPermission();
    if (granted) {
      setPushAttemptedDenied(false);
      void updateProfile(profile, { pushGranted: true });
    } else {
      setPushAttemptedDenied(true);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('nset.title')} onBack={() => goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Master switch — everything below is inert while off. */}
        <Card style={styles.card}>
          <ToggleRow
            label={t('nset.enable')}
            value={enabled}
            onToggle={() => void updateProfile(profile, { notifEnabled: !enabled })}
          />
        </Card>

        {/* Per-category prefs — visually muted while the master switch is off. */}
        <View style={enabled ? null : styles.dimmed} pointerEvents={enabled ? 'auto' : 'none'}>
          <SectionLabel>{t('settings.notifications')}</SectionLabel>
          <Card style={styles.card}>
            <ToggleRow
              label={t('nset.beforeLesson')}
              value={profile.notifLessons}
              onToggle={() => void updateProfile(profile, { notifLessons: !profile.notifLessons })}
            />
          </Card>

          {/* «Время напоминания» — only meaningful while lesson reminders are on. */}
          <Text style={[styles.groupLabel, { color: colors.muted }]}>{t('nset.leadTime')}</Text>
          <Segmented
            tabs={LEADS.map((x) => t(x.label))}
            active={t(LEADS.find((x) => x.key === profile.reminderLeadMin)?.label ?? 'lead.60')}
            onChange={(tab) => {
              const next = LEADS.find((x) => t(x.label) === tab);
              if (next) void updateProfile(profile, { reminderLeadMin: next.key });
            }}
          />

          <Card style={[styles.card, styles.cardGap]}>
            <ToggleRow
              label={t('nset.payment')}
              value={profile.notifPayment}
              onToggle={() => void updateProfile(profile, { notifPayment: !profile.notifPayment })}
            />
            <Hairline />
            {/* Debts are a SEPARATE toggle from payments (spec 09 §9.3). */}
            <ToggleRow
              label={t('nset.debts')}
              value={debts}
              onToggle={() => void updateProfile(profile, { notifDebts: !debts })}
            />
            <Hairline />
            <ToggleRow
              label={t('settings.notifSchedule')}
              value={profile.notifSchedule}
              onToggle={() => void updateProfile(profile, { notifSchedule: !profile.notifSchedule })}
            />
            <Hairline />
            <ToggleRow
              label={t('nset.summary')}
              value={profile.notifSummary}
              onToggle={() => void updateProfile(profile, { notifSummary: !profile.notifSummary })}
            />
          </Card>

          {/* Push permission — request + state (re-homed from the old flat settings screen). */}
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
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.pushBtn,
                  { backgroundColor: colors.primary, borderRadius: radius.field },
                  pressed && styles.pressed,
                ]}>
                <Icon name="bell" size={18} sw={1.8} stroke={colors.onTint} />
                <Text style={[styles.pushBtnLabel, { color: colors.onTint }]}>{t('settings.pushRequest')}</Text>
              </Pressable>
              {pushAttemptedDenied ? (
                <Text style={[styles.pushDenied, { color: colors.muted }]}>{t('settings.pushDenied')}</Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A label + switch row (mirrors settings.tsx's Toggle idiom). */
function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.heading }]} numberOfLines={1}>
        {label}
      </Text>
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

/** Compact stack header — mirrors notifications.tsx (this stack has headerShown:false). */
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
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 14 },

  card: { paddingHorizontal: 14 },
  cardGap: { marginTop: 14 },
  groupLabel: { fontSize: 13, fontWeight: '500', marginTop: 14, marginBottom: 10 },
  dimmed: { opacity: 0.45 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },

  // switch (mirrors settings.tsx)
  track: { width: 46, height: 28, borderRadius: 14, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11 },
  thumbOn: { alignSelf: 'flex-end', marginRight: 3 },
  thumbOff: { alignSelf: 'flex-start', marginLeft: 3 },

  hairline: { height: StyleSheet.hairlineWidth },

  // push permission (mirrors the old flat settings screen)
  pushBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 4 },
  pushBtnLabel: { fontSize: 15, fontWeight: '600' },
  pushState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    marginTop: 4,
  },
  pushStateLabel: { fontSize: 15, fontWeight: '600' },
  pushDenied: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 8, paddingHorizontal: 8 },

  pressed: { opacity: 0.85 },
});
