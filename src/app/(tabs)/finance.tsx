/**
 * Finance root tab (Phase 2, ADR-0011/0012). A period-scoped, searchable, grouped
 * feed of money events — a VIEW over the append-only ledger + derived lesson rows.
 *
 * Nothing here computes money: `financeEntries` builds the row union, `entriesInPeriod`
 * scopes it, and `periodSummary` rolls up received/debt — all pure aggregates. The screen
 * only owns presentation state (period / active tab / search query) and routes drill-downs
 * (a lesson-sourced row opens the lesson; a standalone op opens the operation detail).
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PeriodSheet } from '@/components/PeriodSheet';
import { Screen } from '@/components/Screen';
import { useAllLessons, useAllTransactions, useStudents, useSubjects } from '@/db/hooks';
import type { LessonModel, StudentModel, SubjectModel } from '@/db/models';
import { entriesInPeriod, financeEntries, periodSummary } from '@/domain/aggregates';
import type { FinanceEntry, FinanceEntryKind } from '@/domain/types';
import { useT, type StringKey } from '@/i18n';
import { formatRub } from '@/lib/format';
import { currentMonth, shiftPeriod, startOfDay, type Period } from '@/lib/period';
import { nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, Fab, Icon, Segmented } from '@/ui';

/** Finance tabs — a stable key drives filtering; the visible label is the i18n string. */
type FinTab = 'all' | 'paid' | 'debts' | 'expected';

/** A day-bucket of entries for the grouped list (key = local-midnight ms). */
interface DayGroup {
  day: number;
  entries: FinanceEntry[];
}

/** kind → accent colour for the left strip & amount (paid→paid, debt→danger, expected→warning). */
function useKindColor(): (kind: FinanceEntryKind) => string {
  const { colors } = useTheme();
  return (kind) => (kind === 'paid' ? colors.paid : kind === 'debt' ? colors.danger : colors.warning);
}

export default function FinanceScreen() {
  const t = useT();
  const { colors, radius } = useTheme();
  const router = useRouter();
  const kindColor = useKindColor();

  // ── Presentation state (period / active tab / search; period defaults to this month) ──
  const [period, setPeriod] = useState<Period>(() => currentMonth());
  const [tab, setTab] = useState<FinTab>('all');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [query, setQuery] = useState('');

  // ── Reactive data (whole ledger + lessons; students/subjects for name resolution) ──
  const lessons = useAllLessons();
  const txns = useAllTransactions();
  const students = useStudents();
  const subjects = useSubjects();

  const studentsById = useMemo(() => {
    const m = new Map<string, StudentModel>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);
  const subjectsById = useMemo(() => {
    const m = new Map<string, SubjectModel>();
    for (const s of subjects) m.set(s.id, s);
    return m;
  }, [subjects]);
  // Lesson lookup — resolves a lesson-sourced row's meta line (its topic) for the subtitle.
  const lessonsById = useMemo(() => {
    const m = new Map<string, LessonModel>();
    for (const l of lessons) m.set(l.id, l);
    return m;
  }, [lessons]);

  // ── View-model: full entry union, then period-scoped (both pure aggregates) ──
  const allEntries = useMemo(() => financeEntries(lessons, txns), [lessons, txns]);
  const inPeriod = useMemo(() => entriesInPeriod(allEntries, period), [allEntries, period]);

  // Header summary (received flow + in-period debt) over the period slice (ADR-0012).
  const summary = useMemo(() => periodSummary(inPeriod), [inPeriod]);

  // ── Filter by tab (kind) then by query (case-insensitive student-name contains) ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inPeriod.filter((e) => {
      if (tab === 'paid' && e.kind !== 'paid') return false;
      if (tab === 'debts' && e.kind !== 'debt') return false;
      if (tab === 'expected' && e.kind !== 'expected') return false;
      if (q) {
        const name = studentsById.get(e.studentId)?.name ?? '';
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [inPeriod, tab, query, studentsById]);

  // ── Group the filtered rows by local day, newest day first (already time-desc inside) ──
  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<number, FinanceEntry[]>();
    for (const e of filtered) {
      const day = startOfDay(e.occurredAt);
      const arr = byDay.get(day);
      if (arr) arr.push(e);
      else byDay.set(day, [e]);
    }
    return [...byDay.entries()]
      .map(([day, entries]) => ({ day, entries }))
      .sort((a, b) => b.day - a.day);
  }, [filtered]);

  const todayStart = startOfDay(nowMs());

  // ── Tab label ↔ key bridge (Segmented matches by the visible string). ──
  const TAB_LABEL: Record<FinTab, string> = {
    all: t('finance.tab.all'),
    paid: t('finance.tab.paid'),
    debts: t('finance.tab.debts'),
    expected: t('finance.tab.expected'),
  };
  const tabLabels = [TAB_LABEL.all, TAB_LABEL.paid, TAB_LABEL.debts, TAB_LABEL.expected];
  const onTabChange = (label: string) => {
    const next = (Object.keys(TAB_LABEL) as FinTab[]).find((k) => TAB_LABEL[k] === label);
    if (next) setTab(next);
  };

  // ── Period navigator label («Май 2026» / «2026» / «1–7 июня») — see helper below. ──
  const dateLabel = useDateLabel();
  const periodLabel = usePeriodLabel();
  const isCustom = period.type === 'custom';

  // Drill-down: lesson-sourced row → the lesson card; standalone op → the operation detail.
  const openEntry = (e: FinanceEntry) => {
    if (e.source === 'lesson' && e.lessonId) {
      router.push({ pathname: '/lesson/[id]', params: { id: e.lessonId } });
    } else {
      router.push({ pathname: '/finance/[id]', params: { id: e.id } });
    }
  };

  // Meta subtitle under the name: lesson topic / subject for a lesson row, else the kind word.
  const metaOf = (e: FinanceEntry): string => {
    if (e.source === 'lesson' && e.lessonId) {
      const topic = lessonsById.get(e.lessonId)?.topic?.trim();
      if (topic) return topic;
    }
    if (e.subjectId) {
      const name = subjectsById.get(e.subjectId)?.name;
      if (name) return name;
    }
    return t(`pay.${e.kind}` as StringKey);
  };

  return (
    <Screen
      title={t('finance.title')}
      floatingAction={<Fab onPress={() => router.push('/finance/new')} />}>
      {/* 1 · Period navigator — ± stepper (disabled for custom) + tappable label opening the sheet. */}
      <View style={styles.periodBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.prevMonth')}
          disabled={isCustom}
          onPress={() => setPeriod(shiftPeriod(period, -1))}
          hitSlop={8}
          style={({ pressed }) => [styles.periodArrow, pressed && !isCustom && styles.pressed]}>
          <Icon name="chevronLeft" size={20} sw={1.9} stroke={isCustom ? colors.stoneInactive : colors.stone700} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setPeriodOpen(true)}
          hitSlop={6}
          style={({ pressed }) => [styles.periodTitle, pressed && styles.pressed]}>
          <Text style={[styles.periodLabel, { color: colors.heading }]}>{periodLabel(period)}</Text>
          <Icon name="chevronDown" size={16} sw={1.9} stroke={colors.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.nextMonth')}
          disabled={isCustom}
          onPress={() => setPeriod(shiftPeriod(period, 1))}
          hitSlop={8}
          style={({ pressed }) => [styles.periodArrow, pressed && !isCustom && styles.pressed]}>
          <Icon name="chevronRight" size={20} sw={1.9} stroke={isCustom ? colors.stoneInactive : colors.stone700} />
        </Pressable>
      </View>

      {/* 2 · Summary — received (paid flow) | debt (in-period), split by a thin divider. */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryCaption, { color: colors.muted }]}>{t('finance.received')}</Text>
            <Text style={[styles.summaryReceived, { color: colors.paid }]}>{formatRub(summary.received)}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.hairline }]} />
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryCaption, { color: colors.muted }]}>{t('finance.debt')}</Text>
            <Text style={[styles.summaryDebt, { color: colors.danger }]}>{formatRub(summary.debt)}</Text>
          </View>
        </View>
      </Card>

      {/* 3 · Kind tabs. */}
      <Segmented tabs={tabLabels} active={TAB_LABEL[tab]} onChange={onTabChange} />

      {/* 4 · Inline search over operations (by student name). */}
      <View style={[styles.searchRow, { backgroundColor: colors.stoneLight, borderRadius: radius.field }]}>
        <Icon name="search" size={19} sw={1.7} stroke={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('finance.searchOps')}
          placeholderTextColor={colors.label3}
          style={[styles.searchInput, { color: colors.heading }]}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.clearSearch')}
            onPress={() => setQuery('')}
            hitSlop={8}>
            <Icon name="close" size={17} sw={1.8} stroke={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* 5/6 · Grouped list + empty states. */}
      {allEntries.length === 0 ? (
        // No data at all in the whole ledger.
        <EmptyState icon="wallet" text={t('finance.empty')} />
      ) : groups.length === 0 ? (
        // There IS data, but the current period/tab slice is empty — say which.
        <Card style={styles.emptySliceCard}>
          <Text style={[styles.emptySliceText, { color: colors.muted }]}>
            {inPeriod.length === 0 ? t('finance.noOpsPeriod') : t('finance.noOpsTab')}
          </Text>
        </Card>
      ) : (
        groups.map((g) => (
          <View key={g.day} style={styles.group}>
            {/* Day header: «Сегодня» for today, else «<day> <month-genitive>». */}
            <Text style={[styles.groupHeader, { color: colors.muted }]}>
              {g.day === todayStart ? t('group.today') : dateLabel(g.day)}
            </Text>
            <Card>
              {g.entries.map((e, i) => (
                <View key={e.id}>
                  {i > 0 ? <View style={[styles.hairline, { backgroundColor: colors.hairline }]} /> : null}
                  <Pressable
                    onPress={() => openEntry(e)}
                    style={({ pressed }) => [styles.opRow, pressed && styles.pressed]}>
                    {/* Left accent strip coloured by kind. */}
                    <View style={[styles.opStrip, { backgroundColor: kindColor(e.kind) }]} />
                    <View style={styles.opBody}>
                      <Text numberOfLines={1} style={[styles.opName, { color: colors.heading }]}>
                        {studentsById.get(e.studentId)?.name ?? t('common.none')}
                      </Text>
                      <Text numberOfLines={1} style={[styles.opMeta, { color: colors.muted }]}>
                        {metaOf(e)}
                      </Text>
                    </View>
                    <Text style={[styles.opAmount, { color: kindColor(e.kind) }]}>
                      {e.kind === 'paid' ? '+' : ''}
                      {formatRub(e.amount)}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        ))
      )}

      {/* Shared period selector (week/month/year/custom). */}
      <PeriodSheet
        visible={periodOpen}
        period={period}
        onClose={() => setPeriodOpen(false)}
        onApply={(p) => setPeriod(p)}
      />
    </Screen>
  );
}

// ── Date / period labelling (RU, via i18n month keys — mirrors lesson/[id] useDateLabel) ──

/** «8 июня» — genitive day-month from a local-instant ms (for day-group headers). */
function useDateLabel(): (ms: number) => string {
  const t = useT();
  return (ms: number) => {
    const d = new Date(ms);
    return `${d.getDate()} ${t(`monthGen.${d.getMonth()}` as StringKey)}`;
  };
}

/**
 * Period navigator title, composed from the JS Date of `period.start` (and `end − 1`):
 *   month  → «Май 2026» (nominative month + 4-digit year)
 *   year   → «2026»
 *   week   → «1–7 июня» (start-day – end-day + genitive month of the start day)
 *   custom → same day-range shape as week.
 */
function usePeriodLabel(): (period: Period) => string {
  const t = useT();
  return (period) => {
    const start = new Date(period.start);
    if (period.type === 'month') {
      return `${t(`month.${start.getMonth()}` as StringKey)} ${start.getFullYear()}`;
    }
    if (period.type === 'year') {
      return `${start.getFullYear()}`;
    }
    // week / custom — inclusive day range; `end` is exclusive, so the last day is end − 1ms.
    const lastDay = new Date(period.end - 1);
    const monthGen = t(`monthGen.${start.getMonth()}` as StringKey);
    return `${start.getDate()}–${lastDay.getDate()} ${monthGen}`;
  };
}

const styles = StyleSheet.create({
  // Period navigator
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 2,
  },
  periodArrow: { padding: 4 },
  periodTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 130, justifyContent: 'center' },
  periodLabel: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  pressed: { opacity: 0.6 },

  // Summary card
  summaryCard: { paddingVertical: 12, paddingHorizontal: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'stretch' },
  summaryCol: { flex: 1 },
  summaryCaption: { fontSize: 13, fontWeight: '500' },
  summaryReceived: { fontSize: 22, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] },
  summaryDebt: { fontSize: 19, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] },
  summaryDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 14, marginVertical: 2 },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },

  // Empty period/tab slice
  emptySliceCard: { paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center' },
  emptySliceText: { fontSize: 14.5, fontWeight: '500', textAlign: 'center', lineHeight: 20 },

  // Grouped list
  group: { gap: 8 },
  groupHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  opRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingLeft: 16, paddingRight: 14 },
  opStrip: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3 },
  opBody: { flex: 1, minWidth: 0 },
  opName: { fontSize: 15, fontWeight: '600' },
  opMeta: { fontSize: 13, marginTop: 3 },
  opAmount: { fontSize: 15, fontWeight: '600', marginLeft: 12, fontVariant: ['tabular-nums'] },
});
