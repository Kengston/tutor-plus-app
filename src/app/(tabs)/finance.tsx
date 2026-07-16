/**
 * Finance root tab (Phase 2, ADR-0011/0012). A period-scoped, searchable, grouped
 * feed of money events — a VIEW over the append-only ledger + derived lesson rows.
 *
 * Nothing here computes money: `financeEntries` builds the row union, `entriesInPeriod`
 * scopes it, and `periodSummary` rolls up received/debt — all pure aggregates. The screen
 * only owns presentation state (period / active tab / search query) and routes drill-downs
 * (a lesson-sourced row opens the lesson; a standalone op opens the operation detail).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PeriodSheet } from '@/components/PeriodSheet';
import { Screen } from '@/components/Screen';
import { useAllLessons, useAllTransactions, useExpectations, useStudents, useSubjects } from '@/db/hooks';
import type { StudentModel, SubjectModel } from '@/db/models';
import { entriesInPeriod, financeEntries, periodSummary } from '@/domain/aggregates';
import type { FinanceEntry, FinanceEntryKind } from '@/domain/types';
import { useT, type StringKey } from '@/i18n';
import { formatRub } from '@/lib/format';
import { currentMonth, shiftPeriod, startOfDay, type Period } from '@/lib/period';
import { hhmm, nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, CatAvatar, Fab, Icon, Segmented } from '@/ui';

/** Finance tabs — a stable key drives filtering; the visible label is the i18n string. */
type FinTab = 'all' | 'paid' | 'debts' | 'expected';

/** A day-bucket of entries for the grouped list (key = local-midnight ms). */
interface DayGroup {
  day: number;
  entries: FinanceEntry[];
}

/** kind → amount colour: paid→paid, debt→danger, expected→NEUTRAL (stone700, spec 07 §7.2). */
function useKindColor(): (kind: FinanceEntryKind) => string {
  const { colors } = useTheme();
  return (kind) => (kind === 'paid' ? colors.paid : kind === 'debt' ? colors.danger : colors.stone700);
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
  const [infoOpen, setInfoOpen] = useState(false); // ⓘ tap-to-reveal on «Фактически получено»

  // Deep-link entry (`?tab=debts` — «Все задолженности в финансах», spec 08 §8.3). Applied once
  // per param PAIR via the render-time state-adjustment idiom (mirrors schedule.tsx) so the user
  // can freely switch tabs afterwards without the stale param snapping back; the sender attaches
  // a `t` nonce so repeated drill-ins re-apply even when the tab value is the same.
  const params = useLocalSearchParams<{ tab?: string; t?: string }>();
  const paramsKey = `${params.tab ?? ''}|${params.t ?? ''}`;
  const [appliedTabParam, setAppliedTabParam] = useState('|');
  if (paramsKey !== '|' && paramsKey !== appliedTabParam) {
    setAppliedTabParam(paramsKey);
    if (params.tab === 'all' || params.tab === 'paid' || params.tab === 'debts' || params.tab === 'expected') {
      setTab(params.tab);
    }
  }

  // ── Reactive data (whole ledger + lessons + expectations; students/subjects for names) ──
  const lessons = useAllLessons();
  const txns = useAllTransactions();
  const expectations = useExpectations();
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

  // ── View-model: full entry union (incl. open expectations, ADR-0015), then period-scoped ──
  const allEntries = useMemo(
    () => financeEntries(lessons, txns, expectations),
    [lessons, txns, expectations],
  );
  const inPeriod = useMemo(() => entriesInPeriod(allEntries, period), [allEntries, period]);

  // Header summary (received flow + in-period expected + debt) over the period slice (ADR-0012/0015).
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

  // Drill-down: lesson row → the lesson card; expectation → its settle detail; else the op detail.
  const openEntry = (e: FinanceEntry) => {
    if (e.source === 'lesson' && e.lessonId) {
      router.push({ pathname: '/lesson/[id]', params: { id: e.lessonId } });
    } else if (e.source === 'expectation') {
      router.push({ pathname: '/finance/[id]', params: { id: e.id.replace('expectation:', ''), kind: 'expectation' } });
    } else {
      router.push({ pathname: '/finance/[id]', params: { id: e.id } });
    }
  };

  // Secondary line under the name (spec 07 §7.2, mockup): a lesson-anchored row (paid
  // settlement / derived debt|expected — has a real wall-clock instant) shows its time
  // («10:00»); a standalone op / expectation (date-only) shows the subject or the kind word.
  const subtitleOf = (e: FinanceEntry): string => {
    if (e.lessonId != null) return hhmm(e.occurredAt);
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

      {/* 2 · Summary of three (spec 07 §7.1): «Фактически получено» (big, ⓘ) then «Ожидается» | «Задолженность». */}
      <Card style={styles.summaryCard}>
        <Text style={[styles.summaryReceived, { color: colors.paid }]}>{formatRub(summary.received)}</Text>
        <View style={styles.receivedCaptionRow}>
          <Text style={[styles.summaryCaption, { color: colors.muted }]}>{t('finance.receivedFull')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('finance.receivedHint')}
            onPress={() => setInfoOpen((v) => !v)}
            hitSlop={8}>
            <Icon name="info" size={15} sw={1.8} stroke={infoOpen ? colors.paid : colors.label3} />
          </Pressable>
        </View>
        {infoOpen ? (
          <Text style={[styles.receivedHint, { color: colors.muted }]}>{t('finance.receivedHint')}</Text>
        ) : null}

        <View style={[styles.summarySplit, { borderTopColor: colors.hairline }]}>
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryCaption, { color: colors.muted }]}>{t('finance.expected')}</Text>
            <Text style={[styles.summarySecondary, { color: colors.stone700 }]}>{formatRub(summary.expected)}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.hairline }]} />
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryCaption, { color: colors.muted }]}>{t('finance.debtSummary')}</Text>
            <Text style={[styles.summarySecondary, { color: colors.danger }]}>{formatRub(summary.debt)}</Text>
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
            {/* Day header (caps via style): «СЕГОДНЯ, 26 МАЯ» for today, else «26 МАЯ». */}
            <Text style={[styles.groupHeader, { color: colors.muted }]}>
              {g.day === todayStart ? `${t('group.today')}, ${dateLabel(g.day)}` : dateLabel(g.day)}
            </Text>
            <Card>
              {g.entries.map((e, i) => {
                const student = studentsById.get(e.studentId);
                return (
                  <View key={e.id}>
                    {i > 0 ? <View style={[styles.hairline, { backgroundColor: colors.hairline }]} /> : null}
                    <Pressable
                      onPress={() => openEntry(e)}
                      style={({ pressed }) => [styles.opRow, pressed && styles.pressed]}>
                      {/* Personal marker (initials + category colour) — spec 07 §7.2. */}
                      <CatAvatar initials={student?.initials ?? '—'} cat={student?.category ?? 'slate'} size={38} />
                      <View style={styles.opBody}>
                        <Text numberOfLines={1} style={[styles.opName, { color: colors.heading }]}>
                          {student?.name ?? t('common.none')}
                        </Text>
                        <Text numberOfLines={1} style={[styles.opMeta, { color: colors.muted }]}>
                          {subtitleOf(e)}
                        </Text>
                      </View>
                      <View style={styles.opAmountWrap}>
                        {e.kind === 'paid' ? <Icon name="check" size={14} sw={2.4} stroke={colors.paid} /> : null}
                        <Text style={[styles.opAmount, { color: kindColor(e.kind) }]}>
                          {e.kind === 'paid' ? '+' : ''}
                          {formatRub(e.amount)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
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
    // Compose each endpoint's genitive month separately so cross-month ranges read «29 мая – 4 июня».
    const lastDay = new Date(period.end - 1);
    const startGen = t(`monthGen.${start.getMonth()}` as StringKey);
    const lastGen = t(`monthGen.${lastDay.getMonth()}` as StringKey);
    return start.getMonth() === lastDay.getMonth()
      ? `${start.getDate()}–${lastDay.getDate()} ${lastGen}`
      : `${start.getDate()} ${startGen} – ${lastDay.getDate()} ${lastGen}`;
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

  // Summary card — three figures (spec 07 §7.1)
  summaryCard: { paddingVertical: 16, paddingHorizontal: 16 },
  summaryReceived: { fontSize: 30, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  receivedCaptionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  receivedHint: { fontSize: 12.5, marginTop: 6, lineHeight: 17 },
  summarySplit: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryCol: { flex: 1 },
  summaryCaption: { fontSize: 12.5, fontWeight: '500' },
  summarySecondary: { fontSize: 18, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] },
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
  opRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  opBody: { flex: 1, minWidth: 0 },
  opName: { fontSize: 15, fontWeight: '600' },
  opMeta: { fontSize: 13, marginTop: 3 },
  opAmountWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 12 },
  opAmount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
