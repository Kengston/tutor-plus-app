/**
 * Real app header (ADR-0013, Phase 3; contextual actions UI-v2 S18) — large title + the
 * section's own icon actions (search/filter/sort/export via `actions`) + avatar → settings.
 * The bell (unread dot → notifications feed) is opt-in: per spec 04 it lives on the «Сегодня»
 * header only; section headers carry contextual icons instead (design system, «Шапка раздела»).
 * The unread count is derived live from the same feed builder the list uses.
 */
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  useAllLessons,
  useAllTransactions,
  useNotificationReads,
  useProfile,
  useStudents,
} from '@/db/hooks';
import { buildFeed, unreadCount } from '@/domain/notifications';
import { useNow } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { initialsOf } from '@/lib/format';
import { DEFAULT_REMINDER_PREFS, reminderPrefsOf } from '@/lib/profile';
import { useTheme } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

export function AppHeader({
  title,
  subtitle,
  actions,
  bell,
}: {
  title: string;
  subtitle?: string;
  /** Section-specific icon actions rendered before the avatar (search/filter/sort/export). */
  actions?: ReactNode;
  /** Show the notifications bell — the «Сегодня» header only (spec 04). */
  bell?: boolean;
}) {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();

  const lessons = useAllLessons();
  const transactions = useAllTransactions();
  const students = useStudents();
  const profile = useProfile();
  const reads = useNotificationReads();

  // `now` ticks each minute so a freshly-fired reminder lights the bell promptly. FIELD-level
  // deps on the prefs memo: the profile model mutates IN PLACE (same instance each emission),
  // so [profile] alone would freeze prefs at mount and the master switch would never dim the
  // bell on the mounted home header (review fix S14; see the PROGRESS reactivity note).
  const now = useNow();
  const prefs = useMemo(
    () => (profile ? reminderPrefsOf(profile) : DEFAULT_REMINDER_PREFS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      profile,
      profile?.notifEnabled,
      profile?.notifDebts,
      profile?.notifLessons,
      profile?.notifPayment,
      profile?.notifSchedule,
      profile?.notifSummary,
      profile?.reminderLeadMin,
      profile?.pushGranted,
    ],
  );
  const unread = useMemo(
    () => unreadCount(buildFeed({ lessons, transactions, students, prefs, reads, now })),
    [lessons, transactions, students, prefs, reads, now],
  );
  const initials = profile?.name ? initialsOf(profile.name) : '';

  return (
    <View style={styles.header}>
      <View style={styles.actions}>
        {actions}
        {bell ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `${t('a11y.notifications')}, ${unread}` : t('a11y.notifications')}
            hitSlop={6}
            onPress={() => router.push('/notifications')}
            style={[styles.iconBtn, { backgroundColor: colors.stoneLight }]}>
            <Icon name="bell" size={19} sw={1.8} stroke={colors.stone700} />
            {unread > 0 ? (
              <View style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.bg }]} />
            ) : null}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.profile')}
          hitSlop={6}
          onPress={() => router.push('/settings')}
          style={[styles.avatar, { backgroundColor: colors.primaryVlight }]}>
          {initials ? (
            <Text style={[styles.avatarText, { color: colors.heading }]}>{initials}</Text>
          ) : (
            <Icon name="users" size={16} sw={1.8} stroke={colors.heading} />
          )}
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.heading }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.body }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** One contextual header icon-button; `active` marks an applied search/filter with a dot. */
export function HeaderAction({
  icon,
  label,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
      hitSlop={6}
      onPress={onPress}
      style={[styles.iconBtn, { backgroundColor: active ? colors.primaryVlight : colors.stoneLight }]}>
      <Icon name={icon} size={19} sw={1.8} stroke={active ? colors.primaryDeep : colors.stone700} />
      {active ? (
        <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: colors.bg }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minHeight: 38 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  // Unread dot — top-right of the bell, ringed with the bg so it reads as a badge.
  dot: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  title: { marginTop: 6, fontSize: 30, fontWeight: '600', letterSpacing: -0.6 },
  // Date line under the greeting (spec 04: «вторник, 26 мая»; prototype RootHeader).
  subtitle: { marginTop: 3, fontSize: 15, fontWeight: '500' },
});
