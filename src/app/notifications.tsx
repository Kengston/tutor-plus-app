/**
 * Notifications feed (ADR-0013) — the in-app лента. DERIVED, not stored: the row list is
 * `domain/notifications.buildFeed` over live lessons + the append-only ledger + read-state
 * (`unread = item.id ∉ notification_reads`). The ONLY persistence is read-state, so the two
 * writes here are `markNotificationRead` / `markAllNotificationsRead`.
 *
 * Shell mirrors the other PUSHED routes (finance/new.tsx, finance/[id].tsx): this stack has
 * headerShown:false → a custom Header (back + title + optional «Прочитать всё») inside a
 * SafeAreaView; the body is a ScrollView. Rows reuse the Сегодня idiom (rowShell + SwipeRow +
 * Pressable). All strings via i18n (dual-mode resolves inside t()); all colours via theme tokens.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAllLessons, useAllTransactions, useNotificationReads, useProfile, useStudents } from '@/db/hooks';
import { markAllNotificationsRead, markNotificationRead } from '@/db/mutations';
import { buildFeed, NOTIFICATION_CATEGORIES } from '@/domain/notifications';
import type { NotificationCategory, NotificationItem, NotificationKind } from '@/domain/types';
import { useNow } from '@/hooks/use-now';
import { plural, useT } from '@/i18n';
import { formatRub } from '@/lib/format';
import { useBack } from '@/lib/nav';
import { DEFAULT_REMINDER_PREFS, reminderPrefsOf } from '@/lib/profile';
import { hhmm, minutesUntil } from '@/lib/time';
import { useTheme } from '@/theme';
import { Icon, SectionLabel, Segmented, SwipeRow, Text, type IconName } from '@/ui';

/** Filter axis incl. the «Все» pseudo-category that clears the type filter. */
type Filter = 'all' | NotificationCategory;

/**
 * Read-state tabs. Two, not three, and the type filter is a chips row under them rather than
 * a modal (TP-FIX-0719, п. 7 — приведено к эталонному прототипу; «Прочитанные» = «Все» минус
 * «Непрочитанные», а чипы держат фильтр на виду вместо спрятанной воронки).
 */
type ReadTab = 'all' | 'unread';

/** Time-bucket order — the sections render today → yesterday → earlier. */
const GROUP_ORDER = ['today', 'yesterday', 'earlier'] as const;
type Group = (typeof GROUP_ORDER)[number];

/** Event-type icon by CATEGORY (spec 09 §9.1: часы — занятие, кошелёк — оплата, календарь —
 *  расписание); `system` keeps the sparkle. Rows lead with this icon, not an avatar. */
const CATEGORY_ICON: Record<NotificationCategory, IconName> = {
  lesson: 'clock',
  payment: 'wallet',
  schedule: 'calendar',
  system: 'sparkle',
};

/** Lessons phrasing forms (mode-aware) — for the daily-summary subtitle. */
function lessonForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.lessons.one'), few: t('unit.lessons.few'), many: t('unit.lessons.many') };
}
/** Minutes phrasing forms — for the «через N» reminder subtitle (same as the Сегодня card). */
function minuteForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.minutes.one'), few: t('unit.minutes.few'), many: t('unit.minutes.many') };
}
/** Hours phrasing forms — for the «через N» reminder subtitle. */
function hourForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.hours.one'), few: t('unit.hours.few'), many: t('unit.hours.many') };
}
/** Days phrasing forms — for a 1-day-lead reminder («через 1 день», not «через 24 часа»). */
function dayForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.days.one'), few: t('unit.days.few'), many: t('unit.days.many') };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();

  // ── Build the feed (ADR-0013) — view-model over live data + read-state. ──
  const lessons = useAllLessons();
  const transactions = useAllTransactions();
  const students = useStudents();
  const profile = useProfile();
  const reads = useNotificationReads();
  // `now` ticks each minute so reminders/summary appear and «через N» refreshes while open.
  const now = useNow();
  // FIELD-level deps: the profile model mutates IN PLACE (same reference each emission), so
  // depending on the instance alone would freeze prefs at mount and settings toggles would
  // never reach an already-mounted feed (see the PROGRESS reactivity note / S7).
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
  const items = useMemo(
    () => buildFeed({ lessons, transactions, students, prefs, reads, now }),
    [lessons, transactions, students, prefs, reads, now],
  );

  // ── Filter state: read-state TABS + a visible category chips row (see the ReadTab note). ──
  const [filter, setFilter] = useState<Filter>('all');
  const [readTab, setReadTab] = useState<ReadTab>('all');

  // Read-state tab label ↔ key bridge (Segmented matches by the visible string).
  const READ_LABEL: Record<ReadTab, string> = {
    all: t('notif.filter.all'),
    unread: t('notif.tab.unread'),
  };
  const readTabs = (['all', 'unread'] as ReadTab[]).map((k) => READ_LABEL[k]);
  const onReadTabChange = (label: string) => {
    const next = (['all', 'unread'] as ReadTab[]).find((k) => READ_LABEL[k] === label);
    if (next) setReadTab(next);
  };

  // Category chips: «Все» clears the type axis, the rest narrow it (labels are mode-aware).
  const CATEGORY_LABEL: Record<Filter, string> = {
    all: t('notif.filter.all'),
    lesson: t('notif.filter.lesson'),
    payment: t('notif.filter.payment'),
    schedule: t('notif.filter.schedule'),
    system: t('notif.filter.system'),
  };

  // Apply both axes: type (unless «Все») and the read-state tab.
  const filtered = useMemo(
    () => items.filter((it) => (filter === 'all' || it.category === filter) && (readTab === 'all' || it.unread)),
    [items, filter, readTab],
  );

  // Bucket the filtered rows into the three time groups (empty groups are skipped at render).
  const sections = useMemo(() => {
    const by: Record<Group, NotificationItem[]> = { today: [], yesterday: [], earlier: [] };
    for (const it of filtered) by[it.group].push(it);
    return GROUP_ORDER.map((g) => ({ group: g, rows: by[g] })).filter((s) => s.rows.length > 0);
  }, [filtered]);

  const GROUP_LABEL: Record<Group, string> = {
    today: t('notif.group.today'),
    yesterday: t('notif.group.yesterday'),
    earlier: t('notif.group.earlier'),
  };

  // Tap → the notification DETAIL screen (spec 09 §9.2 — not the target directly); also marks read.
  const openItem = (it: NotificationItem) => {
    void markNotificationRead(it.id);
    router.push({ pathname: '/notification/[id]', params: { id: it.id } });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header
        title={t('notif.title')}
        onBack={() => goBack()}
        action={
          // Acts on the VISIBLE (filtered) set — least surprise when a type/read filter is active.
          filtered.some((i) => i.unread)
            ? { label: t('notif.markAllRead'), onPress: () => void markAllNotificationsRead(filtered.map((i) => i.id)) }
            : undefined
        }
        icons={[{ name: 'sliders', label: t('a11y.notifSettings'), onPress: () => router.push('/notification-settings') }]}
      />

      {/* Read-state tabs: Все / Непрочитанные. */}
      <Segmented tabs={readTabs} active={READ_LABEL[readTab]} onChange={onReadTabChange} />

      {/* Category chips right under the tabs — the type filter stays visible (эталон). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catChips}
        style={styles.catChipsRow}>
        {(['all', ...NOTIFICATION_CATEGORIES] as Filter[]).map((k) => {
          const on = filter === k;
          return (
            <Pressable
              key={k}
              onPress={() => setFilter(k)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.catChip,
                {
                  backgroundColor: on ? colors.primaryVlight : colors.surface,
                  borderColor: on ? colors.primary : colors.hairline,
                  borderRadius: radius.pill,
                },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.catChipLabel, { color: on ? colors.primary : colors.body }]}>
                {CATEGORY_LABEL[k]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          // Nothing in the feed at all.
          <Empty title={t('notif.empty')} hint={t('notif.emptyHint')} />
        ) : filtered.length === 0 ? (
          // Feed has rows, but the active filter hides them all.
          <Empty title={t('notif.emptyFiltered')} />
        ) : (
          sections.map(({ group, rows }) => (
            <View key={group} style={styles.section}>
              {/* Черта выключена точечно: здесь лейбл — группировка списка (Сегодня/Вчера/
                  Ранее), а не заголовок секции; канон §8 оставляет группы без черты. */}
              <SectionLabel accent={false}>{GROUP_LABEL[group]}</SectionLabel>
              <View style={styles.list}>
                {rows.map((it) => (
                  <Row key={it.id} item={it} onOpen={openItem} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

/** A single feed row — swipe-right «Прочитать», tap to drill down + mark read. */
function Row({ item, onOpen }: { item: NotificationItem; onOpen: (it: NotificationItem) => void }) {
  const t = useT();
  const { colors, radius } = useTheme();

  // Title template per kind (mode-aware via t()).
  const TITLE: Record<NotificationKind, string> = {
    reminder: t('notif.reminder'),
    payment: t('notif.payment'),
    debt: t('notif.debt'),
    cancelled: t('notif.cancelled'),
    summary: t('notif.summary'),
  };

  const subtitle = subtitleOf(item, t);
  // Debt is the one «alert» kind — its unread dot reads danger; everything else uses primary.
  const dotColor = item.kind === 'debt' ? colors.danger : colors.primary;

  return (
    <View style={[styles.rowShell, { borderColor: colors.hairline, borderRadius: radius.row }]}>
      <SwipeRow
        leftActions={
          // Already-read rows keep only the (no-op-ish) read action off — show it just for unread.
          item.unread
            ? [
                {
                  // No standalone «Прочитать» key in the frozen lexicon → the dedicated read-action a11y string.
                  label: t('a11y.markRead'),
                  color: colors.paid,
                  icon: 'check',
                  onPress: () => void markNotificationRead(item.id),
                },
              ]
            : []
        }>
        <Pressable
          onPress={() => onOpen(item)}
          accessibilityRole="button"
          accessibilityLabel={`${TITLE[item.kind]}${subtitle ? `, ${subtitle}` : ''}${item.unread ? `, ${t('a11y.unread')}` : ''}`}
          accessibilityState={{ selected: item.unread }}
          style={styles.row}>
          {/* Leading: the event-type icon by category (spec 09 §9.1 — часы/кошелёк/календарь). */}
          <View style={[styles.iconWrap, { backgroundColor: colors.stoneLight }]}>
            <Icon name={CATEGORY_ICON[item.category]} size={20} sw={1.8} stroke={colors.body} />
          </View>

          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: colors.heading }]} numberOfLines={1}>
              {TITLE[item.kind]}
            </Text>
            {subtitle ? (
              <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Trailing: a subtle clock label + the unread dot. */}
          <View style={styles.rowMeta}>
            <Text style={[styles.rowTime, { color: colors.muted }]}>{hhmm(item.time)}</Text>
            {item.unread ? <View style={[styles.unreadDot, { backgroundColor: dotColor }]} /> : null}
          </View>
        </Pressable>
      </SwipeRow>
    </View>
  );
}

/** Compose the mode-aware subtitle for a row (no inline strings beyond punctuation/separators). */
function subtitleOf(item: NotificationItem, t: ReturnType<typeof useT>): string {
  switch (item.kind) {
    case 'reminder': {
      // «<name> · через N минут/часов» — reuse the exact relative phrasing from the Сегодня card.
      const name = item.studentName ?? t('common.none');
      if (item.lessonAt == null) return name;
      const m = minutesUntil(item.lessonAt);
      if (m <= 0) return `${name} · ${t('time.now')}`;
      const rel =
        m < 60
          ? `${t('time.in')} ${m} ${plural(m, minuteForms(t))}`
          : m < 1440
            ? `${t('time.in')} ${Math.round(m / 60)} ${plural(Math.round(m / 60), hourForms(t))}`
            : `${t('time.in')} ${Math.round(m / 1440)} ${plural(Math.round(m / 1440), dayForms(t))}`;
      return `${name} · ${rel}`;
    }
    case 'payment':
    case 'debt':
      return `${item.studentName ?? t('common.none')} · ${formatRub(item.amount ?? 0)}`;
    case 'cancelled':
      return `${item.studentName ?? t('common.none')} · ${item.lessonAt != null ? hhmm(item.lessonAt) : ''}`.trim();
    case 'summary': {
      const n = item.count ?? 0;
      return `${n} ${plural(n, lessonForms(t))}`;
    }
  }
}

/** Compact stack header (this stack has headerShown:false) — mirrors finance/new.tsx, plus a
 *  right action and icon buttons (spec 09 §9.1: «Настройки» и «Фильтр» в шапке). */
function Header({
  title,
  onBack,
  action,
  icons,
}: {
  title: string;
  onBack: () => void;
  action?: { label: string; onPress: () => void };
  icons?: { name: IconName; label: string; onPress: () => void }[];
}) {
  const t = useT();
  const { colors, radius } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}>
        <Icon name="back" size={20} stroke={colors.heading} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.heading }]}>{title}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [
            styles.markAll,
            { backgroundColor: colors.primaryVlight, borderRadius: radius.pill },
            pressed && styles.pressed,
          ]}>
          <Icon name="check" size={15} sw={2} stroke={colors.primary} />
          <Text style={[styles.markAllLabel, { color: colors.primary }]}>{action.label}</Text>
        </Pressable>
      ) : null}
      {icons?.map((b) => (
        <Pressable
          key={b.name}
          onPress={b.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={b.label}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
          <Icon name={b.name} size={18} sw={1.8} stroke={colors.heading} />
        </Pressable>
      ))}
    </View>
  );
}

/** Centred empty block (feed-empty / filtered-empty), styled like EmptyState. */
function Empty({ title, hint }: { title: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Icon name="bell" size={44} sw={1.4} stroke={colors.label3} />
      <Text style={[styles.emptyText, { color: colors.muted }]}>{title}</Text>
      {hint ? <Text style={[styles.emptyHint, { color: colors.muted }]}>{hint}</Text> : null}
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
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, flex: 1 },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7 },
  markAllLabel: { fontSize: 13, fontWeight: '600' },

  // Category chips row under the tabs (эталон) — horizontal, so «Система» never wraps.
  // `flexShrink: 0` is load-bearing: this row is a flex child of the screen column, and RN
  // defaults children to shrinkable. With a long enough feed below it the row got squeezed
  // to 18px and clipped the chips through the middle of their labels.
  catChipsRow: { flexGrow: 0, flexShrink: 0, marginTop: 12 },
  catChips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 2 },
  catChip: { paddingHorizontal: 13, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
  catChipLabel: { fontSize: 13.5, fontWeight: '600' },

  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40, gap: 18 },
  section: { gap: 0 },
  list: { gap: 10 },

  // row shell + inner row (Сегодня idiom)
  rowShell: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  rowSub: { fontSize: 13 },
  rowMeta: { alignItems: 'flex-end', gap: 6 },
  rowTime: { fontSize: 12.5, fontWeight: '500', fontVariant: ['tabular-nums'] },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },

  // empty
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 72, gap: 12 },
  emptyText: { fontSize: 15.5, fontWeight: '500', textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center' },

  pressed: { opacity: 0.85 },
});
