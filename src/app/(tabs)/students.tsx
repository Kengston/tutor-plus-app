import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useStudents, useAllTransactions } from '@/db/hooks';
import type { StudentModel, TransactionModel } from '@/db/models';
import { debtOf } from '@/domain/aggregates';
import type { StudentStatus } from '@/domain/types';
import { plural, useT } from '@/i18n';
import type { StringKey } from '@/i18n';
import { formatRub } from '@/lib/format';
import { catColors, useTheme } from '@/theme';
import { CatAvatar, Card, Fab, Icon, Sheet } from '@/ui';

type FilterKey = 'all' | 'active' | 'paused' | 'archived' | 'debtors';
type SortKey = 'name' | 'added' | 'status' | 'debt';

const FILTERS: { key: FilterKey; label: StringKey }[] = [
  { key: 'all', label: 'filter.all' },
  { key: 'active', label: 'filter.active' },
  { key: 'paused', label: 'filter.paused' },
  { key: 'archived', label: 'filter.archived' },
  { key: 'debtors', label: 'filter.debtors' },
];

const SORTS: { key: SortKey; label: StringKey }[] = [
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

/** Stable display order for the «Статус» sort: active → paused → archived. */
const STATUS_ORDER: Record<StudentStatus, number> = { active: 0, paused: 1, archived: 2 };

export default function StudentsScreen() {
  const t = useT();
  const { colors, radius } = useTheme();
  const router = useRouter();

  const students = useStudents();
  const txns = useAllTransactions();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [query, setQuery] = useState('');
  const [sortOpen, setSortOpen] = useState(false);

  /** Per-student outstanding debt, derived once from the whole ledger (ADR-0008). */
  const debtByStudent = useMemo(() => {
    const groups = new Map<string, TransactionModel[]>();
    for (const tx of txns) {
      const list = groups.get(tx.studentId);
      if (list) list.push(tx);
      else groups.set(tx.studentId, [tx]);
    }
    const map = new Map<string, number>();
    for (const [id, list] of groups) map.set(id, debtOf(list));
    return map;
  }, [txns]);

  const debtFor = (s: StudentModel) => debtByStudent.get(s.id) ?? 0;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = students.filter((s) => {
      if (filter === 'debtors') {
        if (debtFor(s) <= 0) return false;
      } else if (filter !== 'all' && s.status !== filter) {
        return false;
      }
      if (needle && !s.name.toLowerCase().includes(needle)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'added':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'ru');
        case 'debt':
          return debtFor(b) - debtFor(a) || a.name.localeCompare(b.name, 'ru');
        case 'name':
        default:
          return a.name.localeCompare(b.name, 'ru');
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, debtByStudent, filter, sort, query]);

  const countLabel =
    visible.length > 0
      ? `${visible.length} ${plural(visible.length, {
          one: t('unit.students.one'),
          few: t('unit.students.few'),
          many: t('unit.students.many'),
        })}`
      : null;

  const activeSortLabel = t(SORTS.find((s) => s.key === sort)!.label);

  return (
    <Screen
      title={t('students.title')}
      floatingAction={<Fab onPress={() => router.push('/student/new')} />}>
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.pill,
                { backgroundColor: on ? colors.primary : colors.stoneLight },
              ]}>
              <Text
                style={[styles.pillLabel, { color: on ? colors.onTint : colors.body }]}
                numberOfLines={1}>
                {t(f.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search + sort */}
      <View style={styles.toolRow}>
        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.control },
          ]}>
          <Icon name="search" size={18} sw={1.8} stroke={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('students.search')}
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.heading }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('common.cancel')}>
              <Icon name="close" size={16} sw={2} stroke={colors.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setSortOpen(true)}
          style={[
            styles.sortBtn,
            { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.control },
          ]}
          accessibilityLabel={t('sort.label')}>
          <Icon name="sort" size={18} sw={1.8} stroke={colors.heading} />
          <Text style={[styles.sortLabel, { color: colors.heading }]} numberOfLines={1}>
            {activeSortLabel}
          </Text>
        </Pressable>
      </View>

      {countLabel && <Text style={[styles.count, { color: colors.muted }]}>{countLabel}</Text>}

      {/* List / empty */}
      {students.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState icon="users" text={t('students.empty')} />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState icon="search" text={t('students.emptyFiltered')} />
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((s) => (
            <StudentRow
              key={s.id}
              student={s}
              debt={debtFor(s)}
              onPress={() => router.push({ pathname: '/student/[id]', params: { id: s.id } })}
            />
          ))}
        </View>
      )}

      {sortOpen && (
        <SortSheet
          visible={sortOpen}
          current={sort}
          onPick={setSort}
          onClose={() => setSortOpen(false)}
        />
      )}

    </Screen>
  );
}

function StudentRow({
  student,
  debt,
  onPress,
}: {
  student: StudentModel;
  debt: number;
  onPress: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const hasDebt = debt > 0;
  const cat = catColors[student.category] ?? catColors.slate;

  return (
    <Card onPress={onPress} leftStrip={cat.accent} style={styles.row}>
      <CatAvatar
        initials={student.initials}
        cat={student.category}
        payTone={hasDebt ? 'debt' : undefined}
      />
      <View style={styles.rowBody}>
        <Text style={[styles.name, { color: colors.heading }]} numberOfLines={1}>
          {student.name}
        </Text>
        <Text style={[styles.status, { color: colors.muted }]} numberOfLines={1}>
          {t(STATUS_LABEL[student.status])}
        </Text>
      </View>
      {hasDebt && (
        <View style={styles.debtBadge}>
          <Text style={[styles.debtLabel, { color: colors.danger }]}>{t('finance.debt')}</Text>
          <Text style={[styles.debtValue, { color: colors.danger }]}>{formatRub(debt)}</Text>
        </View>
      )}
      <Icon name="chevronRight" size={18} sw={2} stroke={colors.label3} />
    </Card>
  );
}

function SortSheet({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: SortKey;
  onPick: (k: SortKey) => void;
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

  toolRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sortLabel: { fontSize: 13.5, fontWeight: '600', maxWidth: 110 },

  count: { fontSize: 12.5, fontWeight: '500', marginTop: -4 },

  list: { gap: 10 },
  emptyWrap: { paddingTop: 24 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  status: { fontSize: 13 },
  debtBadge: { alignItems: 'flex-end', gap: 1 },
  debtLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  debtValue: { fontSize: 14, fontWeight: '700' },

  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortOptionLabel: { fontSize: 16, fontWeight: '500' },
});
