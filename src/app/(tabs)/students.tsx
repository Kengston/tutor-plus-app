import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useRouter } from 'expo-router';

import { HeaderAction } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { useAllLessons, useAllTransactions, useStudentPrimarySubject, useStudents } from '@/db/hooks';
import type { LessonModel, StudentModel, TransactionModel } from '@/db/models';
import { debtOf } from '@/domain/aggregates';
import {
  filterSortStudents,
  nextUpcomingAt,
  type StudentFilter,
  type StudentListItem,
  type StudentSort,
} from '@/domain/student-list';
import type { StudentStatus } from '@/domain/types';
import { useT } from '@/i18n';
import type { StringKey } from '@/i18n';
import { formatRub } from '@/lib/format';
import { dayBounds, hhmm, nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { CatAvatar, Card, Chip, Fab, Icon, Sheet } from '@/ui';

const FILTERS: { key: StudentFilter; label: StringKey }[] = [
  { key: 'all', label: 'filter.all' },
  { key: 'active', label: 'filter.active' },
  { key: 'paused', label: 'filter.paused' },
  { key: 'archived', label: 'filter.archived' },
  { key: 'debtors', label: 'filter.debtors' },
  { key: 'hasLessons', label: 'filter.hasLessons' },
];

const SORTS: { key: StudentSort; label: StringKey }[] = [
  { key: 'name', label: 'sort.name' },
  { key: 'added', label: 'sort.added' },
  { key: 'status', label: 'sort.status' },
  { key: 'debt', label: 'sort.debt' },
];

const STATUS_LABEL: Record<StudentStatus, StringKey> = {
  active: 'status.active',
  paused: 'status.paused',
  archived: 'status.archived',
};

export default function StudentsScreen() {
  const t = useT();
  const { colors, radius } = useTheme();
  const router = useRouter();

  const students = useStudents();
  const txns = useAllTransactions();
  const lessons = useAllLessons();
  const subjectByStudent = useStudentPrimarySubject();

  const [filter, setFilter] = useState<StudentFilter>('all');
  const [sort, setSort] = useState<StudentSort>('name');
  const [query, setQuery] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  // Header search toggle (spec 06 header: поиск + сортировка); the field stays while a
  // query is set so closing the toggle can never hide an APPLIED search.
  const [searchOpen, setSearchOpen] = useState(false);

  const now = nowMs();

  // Per-student debt (ADR-0008) and next-lesson instant — the row's derived data.
  const items = useMemo<StudentListItem[]>(() => {
    const txByStudent = new Map<string, TransactionModel[]>();
    for (const tx of txns) {
      const arr = txByStudent.get(tx.studentId);
      if (arr) arr.push(tx);
      else txByStudent.set(tx.studentId, [tx]);
    }
    const lessonsByStudent = new Map<string, LessonModel[]>();
    for (const l of lessons) {
      const arr = lessonsByStudent.get(l.studentId);
      if (arr) arr.push(l);
      else lessonsByStudent.set(l.studentId, [l]);
    }
    return students.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      createdAt: s.createdAt.getTime(),
      debt: debtOf(txByStudent.get(s.id) ?? []),
      nextLessonAt: nextUpcomingAt(lessonsByStudent.get(s.id) ?? [], now),
    }));
  }, [students, txns, lessons, now]);

  const visible = useMemo(() => filterSortStudents(items, { filter, sort, query }), [items, filter, sort, query]);

  const searching = query.trim().length > 0;
  // «Найдено: N» while searching/filtering; a plain count otherwise (spec 06 §6.1).
  const countLabel = visible.length > 0 ? `${t('students.found')}: ${visible.length}` : null;

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  return (
    <Screen
      title={t('students.title')}
      actions={
        <>
          <HeaderAction
            icon="search"
            label={t('common.search')}
            active={searching || searchOpen}
            onPress={() => setSearchOpen((v) => !v || searching)}
          />
          <HeaderAction icon="sort" label={t('sort.label')} active={sort !== 'name'} onPress={() => setSortOpen(true)} />
        </>
      }
      floatingAction={<Fab onPress={() => router.push('/student/new')} />}>
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.pill, { backgroundColor: on ? colors.primary : colors.stoneLight }]}>
              <Text style={[styles.pillLabel, { color: on ? colors.onTint : colors.body }]} numberOfLines={1}>
                {t(f.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search field — summoned from the header action (spec 06 header). */}
      {searchOpen || searching ? (
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.control }]}>
          <Icon name="search" size={18} sw={1.8} stroke={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('students.search')}
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.heading }]}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.clearSearch')}>
              <Icon name="close" size={16} sw={2} stroke={colors.muted} />
            </Pressable>
          )}
        </View>
      ) : null}

      {countLabel && <Text style={[styles.count, { color: colors.muted }]}>{countLabel}</Text>}

      {/* List / three empty states (spec 06 §6.1–6.2) */}
      {students.length === 0 ? (
        <EmptyBlock
          icon="users"
          title={t('students.emptyTitle')}
          body={t('students.emptyBody')}
          actionLabel={t('students.addFirst')}
          onAction={() => router.push('/student/new')}
        />
      ) : visible.length === 0 && searching ? (
        <EmptyBlock
          icon="search"
          title={t('students.searchEmpty')}
          body={`${t('students.searchEmptyBy')} «${query.trim()}» ${t('students.searchEmptyNo')}`}
          actionLabel={t('students.clearSearch')}
          onAction={() => {
            setQuery('');
            setSearchOpen(false);
          }}
        />
      ) : visible.length === 0 ? (
        <EmptyBlock icon="filter" title={t('students.emptyFiltered')} body={t('students.emptyFilters')} />
      ) : (
        <View style={styles.list}>
          {visible.map((s) => {
            const model = studentById.get(s.id);
            if (!model) return null;
            return (
              <StudentRow
                key={s.id}
                model={model}
                item={s}
                subject={subjectByStudent.get(s.id) ?? null}
                now={now}
                onPress={() => router.push({ pathname: '/student/[id]', params: { id: s.id } })}
              />
            );
          })}
        </View>
      )}

      {sortOpen && <SortSheet visible={sortOpen} current={sort} onPick={setSort} onClose={() => setSortOpen(false)} />}
    </Screen>
  );
}

/** «следующее сегодня/завтра, 16:00» from the next-lesson instant, or null. */
function useNextLessonLabel(): (nextAt: number | null, now: number) => string | null {
  const t = useT();
  return (nextAt, now) => {
    if (nextAt === null) return null;
    const today = dayBounds(now).start;
    const day = new Date(nextAt);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const when =
      dayStart === today
        ? t('students.today')
        : dayStart === today + 86_400_000
          ? t('students.tomorrow')
          : `${day.getDate()} ${t(`monthGen.${day.getMonth()}` as StringKey)}`;
    return `${t('students.nextLesson')} ${when}, ${hhmm(nextAt)}`;
  };
}

/** A students-list row (spec 06 §6.1): avatar, name, «Предмет · следующее…», debt/status badge. */
function StudentRow({
  model,
  item,
  subject,
  now,
  onPress,
}: {
  model: StudentModel;
  item: StudentListItem;
  subject: string | null;
  now: number;
  onPress: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const nextLabel = useNextLessonLabel();
  const hasDebt = item.debt > 0;
  const isArchived = item.status === 'archived';
  const isPaused = item.status === 'paused';

  // Secondary line: «Предмет · следующее …» — subject and/or next-lesson, else status.
  const next = nextLabel(item.nextLessonAt, now);
  const parts = [subject, next].filter(Boolean);
  const secondary = parts.length > 0 ? parts.join(' · ') : t(STATUS_LABEL[item.status]);

  return (
    <Card onPress={onPress} style={styles.row}>
      <CatAvatar initials={model.initials} cat={model.category} payTone={hasDebt ? 'debt' : undefined} />
      <View style={styles.rowBody}>
        <Text style={[styles.name, { color: colors.heading }]} numberOfLines={1}>{model.name}</Text>
        <Text style={[styles.secondary, { color: colors.muted }]} numberOfLines={1}>{secondary}</Text>
      </View>
      {/* Right badge: debt «N ₽» takes priority; else a status chip for paused/archived. */}
      {hasDebt ? (
        <Chip tone="danger">{formatRub(item.debt)}</Chip>
      ) : isArchived || isPaused ? (
        <Chip>{t(STATUS_LABEL[item.status])}</Chip>
      ) : null}
      <Icon name="chevronRight" size={18} sw={2} stroke={colors.label3} />
    </Card>
  );
}

/** A centred empty state with an optional action button (spec 06 §6.2). */
function EmptyBlock({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: 'users' | 'search' | 'filter';
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={styles.emptyBlock}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.stoneLight }]}>
        <Icon name={icon} size={26} sw={1.6} stroke={colors.stoneInactive} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.heading }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.muted }]}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.emptyAction, { backgroundColor: colors.primary, borderRadius: radius.field }, pressed && styles.pressed]}>
          <Text style={[styles.emptyActionLabel, { color: colors.onTint }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SortSheet({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: StudentSort;
  onPick: (k: StudentSort) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <Sheet title={t('sort.label')} visible={visible} onClose={onClose}>
      {SORTS.map((s) => {
        const on = s.key === current;
        return (
          <Pressable
            key={s.key}
            onPress={() => {
              onPick(s.key);
              onClose();
            }}
            style={[styles.sortOption, { borderBottomColor: colors.hairline }]}>
            <Text style={[styles.sortOptionLabel, { color: colors.heading }]}>{t(s.label)}</Text>
            {on && <Icon name="check" size={20} sw={2} stroke={colors.primary} />}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999 },
  pillLabel: { fontSize: 13, fontWeight: '600' },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },

  count: { fontSize: 12.5, fontWeight: '500', marginTop: -4 },

  list: { gap: 10 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  secondary: { fontSize: 13 },

  // empty states
  emptyBlock: { alignItems: 'center', gap: 10, paddingTop: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16.5, fontWeight: '700', letterSpacing: -0.2, textAlign: 'center', marginTop: 4 },
  emptyBody: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  emptyAction: { paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  emptyActionLabel: { fontSize: 15, fontWeight: '600' },

  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortOptionLabel: { fontSize: 16, fontWeight: '500' },
  pressed: { opacity: 0.85 },
});
