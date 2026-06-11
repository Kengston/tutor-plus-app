/**
 * Real app header (ADR-0013, Phase 3) — replaces the Phase-0 DevBar as the screen header:
 * large title + bell (with an unread dot) → notifications feed, + avatar → settings. The unread
 * count is derived live from the same feed builder the list uses (`domain/notifications`).
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useAllLessons,
  useAllTransactions,
  useNotificationReads,
  useProfile,
  useStudents,
} from '@/db/hooks';
import { buildFeed, unreadCount } from '@/domain/notifications';
import { useT } from '@/i18n';
import { initialsOf } from '@/lib/format';
import { DEFAULT_REMINDER_PREFS, reminderPrefsOf } from '@/lib/profile';
import { nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { Icon } from '@/ui';

export function AppHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();

  const lessons = useAllLessons();
  const transactions = useAllTransactions();
  const students = useStudents();
  const profile = useProfile();
  const reads = useNotificationReads();

  const prefs = profile ? reminderPrefsOf(profile) : DEFAULT_REMINDER_PREFS;
  const unread = unreadCount(
    buildFeed({ lessons, transactions, students, prefs, reads, now: nowMs() }),
  );
  const initials = profile?.name ? initialsOf(profile.name) : '';

  return (
    <View style={styles.header}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.notifications')}
          hitSlop={6}
          onPress={() => router.push('/notifications')}
          style={[styles.iconBtn, { backgroundColor: colors.stoneLight }]}>
          <Icon name="bell" size={19} sw={1.8} stroke={colors.stone700} />
          {unread > 0 ? (
            <View style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.bg }]} />
          ) : null}
        </Pressable>
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
    </View>
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
});
