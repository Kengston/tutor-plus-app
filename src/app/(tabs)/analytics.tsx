/**
 * Analytics tab (ADR-0012) — read-only insight surface over the SAME derived layer the
 * Finance screen reads (domain/aggregates over the live transactions/lessons ledger).
 *
 * Three sub-tabs share one period frame:
 *   • Обзор          — income month-bars, KPI row, subject-share donut, top directions, Δ vs prev
 *   • Динамика       — weekly income bars + Δ vs prev
 *   • Задолженности  — debtors list (cross-ledger, drills into the student card)
 *
 * Every number is DERIVED here in render via the pure aggregates (never stored). Period is
 * local useState; the shared PeriodSheet switches its type/range. CSV export ships now (web);
 * PDF/Excel are deferred («скоро»). Strings via i18n, colours via theme — no inline UI copy /
 * hex. Web-first (the app is wrapped in a centred ~430px column).
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PeriodSheet } from '@/components/PeriodSheet';
import { Screen } from '@/components/Screen';
import { useAllLessons, useAllTransactions, useStudents, useSubjects } from '@/db/hooks';
import type { LessonModel } from '@/db/models';
import {
  avgCheckInPeriod,
  cancellationsInPeriod,
  debtors,
  entriesInPeriod,
  financeEntries,
  incomeByFormat,
  incomeByStudent,
  incomeInPeriod,
  lessonsByBucket,
  lessonsConductedInPeriod,
  metricDelta,
  overviewInsights,
  paidByBucket,
  subjectTotals,
  topDirections,
  type OverviewInsight,
} from '@/domain/aggregates';
import { plural, useT, type StringKey } from '@/i18n';
import { downloadCsv, toCsv } from '@/lib/csv';
import { formatNumberRu, formatRub } from '@/lib/format';
import {
  currentMonth,
  monthOf,
  monthStarts,
  shiftPeriod,
  weekOf,
  weekStarts,
  type Period,
} from '@/lib/period';
import { nowMs } from '@/lib/time';
import { chartColors, useTheme } from '@/theme';
import {
  Card,
  CountUp,
  Donut,
  Icon,
  KpiStat,
  MultiBarChart,
  SectionLabel,
  Segmented,
  Sheet,
  type BarDatum,
  type DonutSegment,
} from '@/ui';

/** Which sub-tab is active (we keep the enum; labels come from i18n at render). */
type Tab = 'overview' | 'dynamics' | 'debts';

/** CSV sections the user can toggle on/off before exporting (Phase-2 «Разделы»). */
interface ExportSections {
  income: boolean;
  lessons: boolean;
  debts: boolean;
}

/** `YYYY-MM-DD` in DEVICE-LOCAL time — keeps CSV dates consistent with the on-screen day groups. */
function localYmd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Compact income label for a bar top: «18к ₽» for thousands, else the plain amount (spec 08 §8.1). */
function shortRub(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}к ₽` : `${n} ₽`;
}

export default function AnalyticsScreen() {
  const t = useT();
  const { colors, radius } = useTheme();
  const router = useRouter();

  // ── Local view state (period is not persisted; ADR-0012) ──
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>(() => currentMonth(nowMs()));
  const [periodOpen, setPeriodOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // ── Reactive ledger + dictionaries ──
  const lessons = useAllLessons();
  const txns = useAllTransactions();
  const students = useStudents();
  const subjects = useSubjects();

  // Name lookups (id → display name) for donut / top / debtors / CSV rows.
  const studentName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) m.set(s.id, s.name);
    return (id: string) => m.get(id) ?? t('common.none');
  }, [students, t]);

  const subjectName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjects) m.set(s.id, s.name);
    return (id: string | null) => (id != null ? (m.get(id) ?? t('common.none')) : t('common.none'));
  }, [subjects, t]);

  // Human period label — reused for the current period AND the Обзор comparison period.
  const periodLabelOf = usePeriodLabel();
  const periodLabel = periodLabelOf(period);

  // Per-tab eyebrow (label before « · <period>»).
  const eyebrow =
    tab === 'overview'
      ? t('analytics.income')
      : tab === 'dynamics'
        ? t('analytics.lessons')
        : t('analytics.debt');

  // Debt is point-in-time (whole-ledger, ADR-0012) — the period selector does NOT scope it,
  // so on the Задолженности tab we drop the period suffix/chevron and don't open the sheet.
  const isDebts = tab === 'debts';

  // ── Big-metric inputs (all DERIVED) ──
  const debtTotal = useMemo(() => debtors(txns).reduce((sum, d) => sum + d.amount, 0), [txns]);
  const conductedCount = lessonsConductedInPeriod(lessons, period);
  const incomeNow = incomeInPeriod(txns, period);

  // ── Coverage: empty when the period has NO paid txns AND NO lessons in it ──
  const hasData = useMemo(() => {
    const anyPaid = txns.some((x) => x.type === 'paid' && x.occurredAt >= period.start && x.occurredAt < period.end);
    const anyLesson = lessons.some((l) => l.startsAt >= period.start && l.startsAt < period.end);
    return anyPaid || anyLesson;
  }, [txns, lessons, period]);

  const resetPeriod = () => setPeriod(currentMonth(nowMs()));

  // Tab labels (i18n) → used both for the Segmented control and to map a tap back to a Tab.
  const overviewLabel = t('analytics.overview');
  const dynamicsLabel = t('analytics.dynamics');
  const debtsLabel = t('analytics.debts');
  const activeLabel = tab === 'overview' ? overviewLabel : tab === 'dynamics' ? dynamicsLabel : debtsLabel;

  return (
    <Screen title={t('analytics.title')}>
      <Segmented
        tabs={[overviewLabel, dynamicsLabel, debtsLabel]}
        active={activeLabel}
        onChange={(label) =>
          setTab(label === overviewLabel ? 'overview' : label === dynamicsLabel ? 'dynamics' : 'debts')
        }
      />

      {/* Top row: tappable period (opens the shared PeriodSheet) + Export action. */}
      <View style={styles.topRow}>
        <Pressable
          onPress={() => setPeriodOpen(true)}
          disabled={isDebts}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.periodBtn, pressed && !isDebts && styles.pressed]}>
          <Text style={[styles.periodText, { color: colors.muted }]} numberOfLines={1}>
            {isDebts ? eyebrow : `${eyebrow} · ${periodLabel}`}
          </Text>
          {!isDebts ? <Icon name="chevronDown" size={15} sw={1.9} stroke={colors.primary} /> : null}
        </Pressable>
        <Pressable
          onPress={() => setExportOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('export.title')}
          hitSlop={8}
          style={({ pressed }) => [styles.exportBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
          <Icon name="share" size={17} sw={1.8} stroke={colors.body} />
        </Pressable>
      </View>

      {isDebts ? (
        // Debt is whole-ledger (point-in-time) → render regardless of in-period coverage.
        <>
          <CountUp value={debtTotal} format={(v) => formatRub(v)} style={StyleSheet.flatten([styles.metric, { color: colors.danger }])} />
          <DebtsBody
            txns={txns}
            studentName={studentName}
            onOpen={(id) => router.push({ pathname: '/student/[id]', params: { id } })}
          />
        </>
      ) : !hasData ? (
        <View style={styles.emptyWrap}>
          <EmptyState icon="chart" text={t('analytics.empty')} hint={t('analytics.noDataHint')} />
          <Pressable
            onPress={resetPeriod}
            style={({ pressed }) => [
              styles.resetBtn,
              { backgroundColor: colors.primaryVlight, borderColor: colors.primaryLight, borderRadius: radius.field },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.resetText, { color: colors.primaryDeep }]}>{t('common.reset')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Big metric — animated. */}
          {tab === 'overview' ? (
            <CountUp value={incomeNow} format={(v) => formatRub(v)} style={StyleSheet.flatten([styles.metric, { color: colors.heading }])} />
          ) : (
            <CountUp
              value={conductedCount}
              format={(v) =>
                `${formatNumberRu(v)} ${plural(Math.round(v), {
                  one: t('unit.lessons.one'),
                  few: t('unit.lessons.few'),
                  many: t('unit.lessons.many'),
                })}`
              }
              style={StyleSheet.flatten([styles.metric, { color: colors.heading }])}
            />
          )}

          {tab === 'overview' ? (
            <OverviewBody
              lessons={lessons}
              txns={txns}
              period={period}
              subjectName={subjectName}
              studentName={studentName}
            />
          ) : (
            <DynamicsBody lessons={lessons} period={period} />
          )}
        </>
      )}

      <PeriodSheet
        visible={periodOpen}
        period={period}
        onClose={() => setPeriodOpen(false)}
        onApply={(p) => setPeriod(p)}
      />

      {exportOpen ? (
        <ExportSheet
          lessons={lessons}
          txns={txns}
          period={period}
          studentName={studentName}
          subjectName={subjectName}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
    </Screen>
  );
}

// ── ОБЗОР ────────────────────────────────────────────────────────────────────

function OverviewBody({
  lessons,
  txns,
  period,
  subjectName,
  studentName,
}: {
  lessons: LessonModel[];
  txns: Parameters<typeof topDirections>[1];
  period: Period;
  subjectName: (id: string | null) => string;
  studentName: (id: string) => string;
}) {
  const t = useT();
  const { colors } = useTheme();
  const periodLabelOf = usePeriodLabel();

  // (a) Income month-bars: 6 month anchors ending at the period's month. Values are shown
  //     persistently (spec 08 §8.1) and the current month is accented; «calm» keeps the rest neutral.
  const monthBars = useMemo<BarDatum[]>(() => {
    const start = new Date(period.start);
    const from = monthOf(new Date(start.getFullYear(), start.getMonth() - 5, 1).getTime()).start; // 6-month window (incl. current)
    const months = monthStarts(from, period.start);
    const vals = paidByBucket(txns, months, (ms) => monthOf(ms).start);
    const max = Math.max(1, ...vals); // avoid /0; flat-zero bars render empty
    return months.map((anchor, i) => ({
      label: t(`month.${new Date(anchor).getMonth()}` as StringKey).slice(0, 3),
      v: vals[i] / max,
      value: formatRub(vals[i]),
      top: shortRub(vals[i]),
      on: i === months.length - 1,
    }));
  }, [txns, period, t]);

  // (b) KPI row.
  const conducted = lessonsConductedInPeriod(lessons, period);
  const cancels = cancellationsInPeriod(lessons, period);
  const avgCheck = avgCheckInPeriod(txns, period);

  // (c) «Структура дохода» — three interchangeable cuts of the SAME period income.
  const dirLabel = t('analytics.byDirections');
  const stuLabel = t('analytics.byStudents');
  const fmtLabel = t('analytics.byFormat');
  const [dim, setDim] = useState<'dir' | 'stu' | 'fmt'>('dir');
  const dimTabs = [dirLabel, stuLabel, fmtLabel];
  const activeDimLabel = dim === 'dir' ? dirLabel : dim === 'stu' ? stuLabel : fmtLabel;

  const structRows = useMemo<{ key: string; name: string; amount: number }[]>(() => {
    if (dim === 'stu') {
      return incomeByStudent(txns, period).map((x) => ({ key: x.studentId, name: studentName(x.studentId), amount: x.amount }));
    }
    if (dim === 'fmt') {
      return incomeByFormat(lessons, txns, period).map((x) => ({ key: x.format, name: t(`format.${x.format}` as StringKey), amount: x.amount }));
    }
    return subjectTotals(txns, period).map((x) => ({ key: String(x.subjectId), name: subjectName(x.subjectId), amount: x.amount }));
  }, [dim, txns, lessons, period, subjectName, studentName, t]);
  const structTotal = structRows.reduce((s, r) => s + r.amount, 0);
  const structSegments = useMemo<DonutSegment[]>(
    () =>
      structRows.map((r, i) => ({
        label: r.name,
        pct: structTotal > 0 ? Math.round((r.amount / structTotal) * 100) : 0,
        color: chartColors[i % 6],
      })),
    [structRows, structTotal],
  );

  // (d) Comparison vs a SELECTABLE period (default: the previous period of the same type).
  //     `comparePeriod` is derived, so it tracks the main period until an explicit one is picked.
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareCustom, setCompareCustom] = useState<Period | null>(null);
  const comparePeriod = compareCustom ?? shiftPeriod(period, -1);
  // A custom main range has NO well-defined "previous period" (shiftPeriod returns it unchanged),
  // so without an explicit pick there is no baseline → «Нет данных для сравнения», not a 0% self-compare.
  const hasBaseline = compareCustom != null || period.type !== 'custom';
  const delta = metricDelta(incomeInPeriod(txns, period), hasBaseline ? incomeInPeriod(txns, comparePeriod) : 0);
  const compareLabel = compareCustom ? periodLabelOf(compareCustom) : t('analytics.comparePrev');

  // (e) «Выводы» — rule-based, composed from the pure generator ([] → correct empty state).
  const insights = useMemo(() => overviewInsights(txns, period, comparePeriod), [txns, period, comparePeriod]);
  const insightText = (ins: OverviewInsight): string => {
    if (ins.kind === 'topDirection') {
      return `${subjectName(ins.subjectId)} — ${t('analytics.insMainDir')}: ${ins.pct}% ${t('analytics.insOfIncome')}`;
    }
    const verb = ins.dir === 'up' ? t('analytics.insIncomeGrew') : t('analytics.insIncomeFell');
    return `${verb} ${ins.pct}% ${t('analytics.insVsCompare')}`;
  };

  return (
    <View style={styles.body}>
      {/* (a) income month-bars — persistent values + accented current month */}
      <Card style={styles.chartCard}>
        <MultiBarChart data={monthBars} height={134} alwaysValue calm />
      </Card>

      {/* (b) KPI row — KpiStat.value is typed string|number (frozen kit), so we pass the
          pre-formatted RU number; avg check uses the same Hermes-safe formatter. */}
      <Card style={styles.kpiCard}>
        <KpiStat label={t('analytics.kpiLessons')} value={formatNumberRu(conducted)} />
        <View style={[styles.kpiSep, { backgroundColor: colors.hairline }]} />
        <KpiStat label={t('analytics.kpiCancels')} value={formatNumberRu(cancels)} color={colors.danger} />
        <View style={[styles.kpiSep, { backgroundColor: colors.hairline }]} />
        <KpiStat label={t('analytics.kpiAvgCheck')} value={formatNumberRu(avgCheck)} />
      </Card>

      {/* (c) «Структура дохода» — sub-tabbed donut + rows (направления / ученики / формат) */}
      <View>
        <SectionLabel>{t('analytics.structure')}</SectionLabel>
        <Segmented
          tabs={dimTabs}
          active={activeDimLabel}
          onChange={(label) => setDim(label === stuLabel ? 'stu' : label === fmtLabel ? 'fmt' : 'dir')}
        />
        <Card style={styles.donutCard}>
          <Donut
            segments={structSegments}
            size={118}
            thickness={20}
            center={
              <View style={styles.donutCenter}>
                <Text numberOfLines={1} style={[styles.donutTotal, { color: colors.heading }]}>
                  {formatRub(structTotal)}
                </Text>
              </View>
            }
          />
          <View style={styles.legend}>
            {structRows.length === 0 ? (
              <Text style={[styles.legendLabel, { color: colors.muted }]}>{t('analytics.empty')}</Text>
            ) : (
              structRows.map((r, i) => (
                <View key={r.key} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: chartColors[i % 6] }]} />
                  <Text numberOfLines={1} style={[styles.legendLabel, { color: colors.body }]}>
                    {r.name}
                  </Text>
                  <Text style={[styles.legendPct, { color: colors.muted }]}>{`${structSegments[i]?.pct ?? 0}%`}</Text>
                  <Text style={[styles.legendAmount, { color: colors.heading }]}>{formatRub(r.amount)}</Text>
                </View>
              ))
            )}
          </View>
        </Card>
      </View>

      {/* (d) comparison with a selectable period */}
      <ComparisonCard delta={delta} compareLabel={compareLabel} onPickCompare={() => setCompareOpen(true)} />

      {/* (e) «Выводы» — rule-based auto-insights (or a correct empty state) */}
      <View>
        <SectionLabel>{t('analytics.insights')}</SectionLabel>
        <Card style={styles.insightsCard}>
          {insights.length === 0 ? (
            <Text style={[styles.insEmpty, { color: colors.muted }]}>{t('analytics.insEmpty')}</Text>
          ) : (
            insights.map((ins, i) => (
              <View key={i}>
                {i > 0 ? <View style={[styles.insSep, { backgroundColor: colors.hairline }]} /> : null}
                <View style={styles.insRow}>
                  <View style={[styles.insIcon, { backgroundColor: colors.accentSoft }]}>
                    <Icon name="sparkle" size={14} sw={1.8} stroke={colors.heading} />
                  </View>
                  <Text style={[styles.insText, { color: colors.body }]}>{insightText(ins)}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </View>

      {/* Compare-period picker — arbitrary period, not just the adjacent one (spec 08 §8.1). */}
      <PeriodSheet
        visible={compareOpen}
        period={comparePeriod}
        onClose={() => setCompareOpen(false)}
        onApply={(p) => setCompareCustom(p)}
      />
    </View>
  );
}

// ── ДИНАМИКА ───────────────────────────────────────────────────────────────────

function DynamicsBody({
  lessons,
  period,
}: {
  lessons: Parameters<typeof lessonsByBucket>[0];
  period: Period;
}) {
  const t = useT();

  // Weekly CONDUCTED-LESSON bars (matches the «Уроки» headline + «Уроки по неделям» section);
  // keep the last ~6 weeks when there are many. Tooltip is a lesson count, not money.
  const weekBars = useMemo<BarDatum[]>(() => {
    let weeks = weekStarts(period.start, period.end);
    if (weeks.length > 6) weeks = weeks.slice(weeks.length - 6);
    const vals = lessonsByBucket(lessons, weeks, (ms) => weekOf(ms).start);
    const max = Math.max(1, ...vals);
    return weeks.map((anchor, i) => ({
      label: String(new Date(anchor).getDate()), // start day-number — DATA, not UI copy
      v: vals[i] / max,
      value: `${formatNumberRu(vals[i])} ${plural(vals[i], {
        one: t('unit.lessons.one'),
        few: t('unit.lessons.few'),
        many: t('unit.lessons.many'),
      })}`,
      on: i === weeks.length - 1,
    }));
  }, [lessons, period, t]);

  // Comparison on conducted-lesson COUNTS vs the previous period of the same type.
  const prev = shiftPeriod(period, -1);
  const delta = metricDelta(lessonsConductedInPeriod(lessons, period), lessonsConductedInPeriod(lessons, prev));

  return (
    <View style={styles.body}>
      <View>
        <SectionLabel>{t('analytics.byWeeks')}</SectionLabel>
        <Card style={styles.chartCard}>
          <MultiBarChart data={weekBars} height={150} />
        </Card>
      </View>
      {/* Comparison skipped for custom ranges (no well-defined previous period). */}
      {period.type !== 'custom' ? <ComparisonCard delta={delta} /> : null}
    </View>
  );
}

// ── ЗАДОЛЖЕННОСТИ ──────────────────────────────────────────────────────────────

function DebtsBody({
  txns,
  studentName,
  onOpen,
}: {
  txns: Parameters<typeof debtors>[0];
  studentName: (id: string) => string;
  onOpen: (studentId: string) => void;
}) {
  const t = useT();
  const { colors } = useTheme();

  const ds = debtors(txns);
  const maxDebt = Math.max(1, ...ds.map((d) => d.amount));

  if (ds.length === 0) {
    return (
      <View style={styles.body}>
        <Card style={styles.emptyDebtCard}>
          <Text style={[styles.emptyDebtTitle, { color: colors.heading }]}>{t('analytics.noDebts')}</Text>
          <Text style={[styles.emptyDebtSub, { color: colors.muted }]}>{t('analytics.allPaid')}</Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <View>
        <SectionLabel>{t('analytics.debtors')}</SectionLabel>
        <Card style={styles.listCard}>
          {ds.map((d) => (
            <Pressable
              key={d.studentId}
              onPress={() => onOpen(d.studentId)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.barRow, pressed && styles.pressed]}>
              <View style={styles.barRowHead}>
                <Text numberOfLines={1} style={[styles.debtorName, { color: colors.heading }]}>
                  {studentName(d.studentId)}
                </Text>
                <View style={styles.debtorAmountWrap}>
                  <Text style={[styles.debtorAmount, { color: colors.danger }]}>{formatRub(d.amount)}</Text>
                  <Icon name="chevronRight" size={16} stroke={colors.stoneInactive} />
                </View>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.dangerLight }]}>
                <View style={[styles.progressFill, { width: `${(d.amount / maxDebt) * 100}%`, backgroundColor: colors.danger }]} />
              </View>
            </Pressable>
          ))}
        </Card>
      </View>
    </View>
  );
}

// ── Comparison card (shared by Обзор + Динамика) ──────────────────────────────

function ComparisonCard({
  delta,
  compareLabel,
  onPickCompare,
}: {
  delta: ReturnType<typeof metricDelta>;
  /** When set (with `onPickCompare`), the card shows a tappable compare-period selector (Обзор). */
  compareLabel?: string;
  onPickCompare?: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const hasPicker = compareLabel != null && onPickCompare != null;

  // Compare-period selector row (Обзор only) — lets the user pick ANY comparison period.
  const selector = hasPicker ? (
    <Pressable
      onPress={onPickCompare}
      accessibilityRole="button"
      style={({ pressed }) => [styles.compareSelector, { borderBottomColor: colors.hairline }, pressed && styles.pressed]}>
      <Text style={[styles.compareSelectorLabel, { color: colors.muted }]}>{t('analytics.comparePick')}</Text>
      <View style={styles.compareSelectorValue}>
        <Text style={[styles.compareSelectorText, { color: colors.heading }]} numberOfLines={1}>
          {compareLabel}
        </Text>
        <Icon name="chevronDown" size={15} sw={1.9} stroke={colors.primary} />
      </View>
    </Pressable>
  ) : null;

  // No baseline (comparison period had no income) → nothing to compare against.
  if (delta.pct === null) {
    return (
      <View>
        <SectionLabel>{t('analytics.comparison')}</SectionLabel>
        <Card style={styles.compareCard}>
          {selector}
          <View style={styles.compareInfoRow}>
            <Icon name="info" size={16} sw={1.8} stroke={colors.muted} />
            <Text style={[styles.compareInfoText, { color: colors.muted }]}>{t('analytics.noCompare')}</Text>
          </View>
        </Card>
      </View>
    );
  }

  // Income up = good → accentSoft pill; down = danger pill. Sign the percentage explicitly.
  const good = delta.dir === 'up' || delta.dir === 'flat';
  const sign = delta.pct > 0 ? '+' : '';
  return (
    <View>
      <SectionLabel>{t('analytics.comparison')}</SectionLabel>
      <Card style={styles.compareCard}>
        {selector}
        <View style={styles.compareResultRow}>
          <View style={[styles.comparePill, { backgroundColor: good ? colors.accentSoft : colors.dangerLight }]}>
            <Text style={[styles.comparePillText, { color: good ? colors.heading : colors.danger }]}>
              {`${sign}${delta.pct}%`}
            </Text>
          </View>
          <Text style={[styles.compareVs, { color: colors.muted }]}>
            {hasPicker ? t('analytics.vsCompare') : t('analytics.vsPrev')}
          </Text>
        </View>
      </Card>
    </View>
  );
}

// ── Export sheet (CSV now; PDF/Excel deferred) ────────────────────────────────

function ExportSheet({
  lessons,
  txns,
  period,
  studentName,
  subjectName,
  onClose,
}: {
  lessons: Parameters<typeof financeEntries>[0];
  txns: Parameters<typeof financeEntries>[1];
  period: Period;
  studentName: (id: string) => string;
  subjectName: (id: string | null) => string;
  onClose: () => void;
}) {
  const t = useT();
  const { colors, radius } = useTheme();

  // CSV is the only enabled format (ADR-0012); PDF/Excel show «скоро».
  const formats: { key: 'csv' | 'pdf' | 'excel'; label: string; enabled: boolean }[] = [
    { key: 'csv', label: 'CSV', enabled: true },
    { key: 'pdf', label: 'PDF', enabled: false },
    { key: 'excel', label: 'Excel', enabled: false },
  ];

  const [sections, setSections] = useState<ExportSections>({ income: true, lessons: true, debts: true });
  const [done, setDone] = useState(false);

  const toggle = (k: keyof ExportSections) => setSections((s) => ({ ...s, [k]: !s[k] }));

  // Build the CSV from the in-period finance entries, honouring the «Разделы» toggles
  // (Доходы→paid · Занятия→expected · Задолженности→debt).
  const generate = () => {
    const rows = entriesInPeriod(financeEntries(lessons, txns), period).filter(
      (e) =>
        (e.kind === 'paid' && sections.income) ||
        (e.kind === 'expected' && sections.lessons) ||
        (e.kind === 'debt' && sections.debts),
    );
    const header: (string | number)[] = [
      t('field.date'),
      t('field.student'),
      t('finance.subject'),
      t('finance.amount'),
      t('finance.status'),
      t('finance.method'),
    ];
    const body = rows.map((e) => [
      localYmd(e.occurredAt), // YYYY-MM-DD in DEVICE-LOCAL time (matches the on-screen dates)
      studentName(e.studentId),
      subjectName(e.subjectId),
      e.amount,
      t(`pay.${e.kind}` as StringKey),
      e.method ? t(`method.${e.method}` as StringKey) : t('common.none'),
    ]);
    downloadCsv('tutor-plus-report', toCsv([header, ...body]));
    setDone(true);
  };

  return (
    <Sheet title={t('export.title')} onClose={onClose}>
      {/* Формат — only CSV enabled. */}
      <Text style={[styles.exportLabel, { color: colors.muted }]}>{t('export.format')}</Text>
      <View style={styles.formatRow}>
        {formats.map((f) => (
          <View key={f.key} style={styles.formatCol}>
            <View
              style={[
                styles.formatBtn,
                {
                  backgroundColor: f.enabled ? colors.primary : colors.stoneLight,
                  borderColor: colors.hairline,
                  borderWidth: f.enabled ? 0 : StyleSheet.hairlineWidth,
                  borderRadius: radius.field,
                },
              ]}>
              <Text style={[styles.formatText, { color: f.enabled ? colors.onTint : colors.muted }]}>
                {f.label}
              </Text>
            </View>
            {!f.enabled ? <Text style={[styles.formatSoon, { color: colors.muted }]}>{t('export.soon')}</Text> : null}
          </View>
        ))}
      </View>

      {/* Разделы — toggle checkboxes. */}
      <Text style={[styles.exportLabel, { color: colors.muted }]}>{t('export.sections')}</Text>
      <Card style={styles.sectionsCard}>
        <SectionToggle label={t('export.income')} on={sections.income} onPress={() => toggle('income')} />
        <View style={[styles.sectionsSep, { backgroundColor: colors.hairline }]} />
        <SectionToggle label={t('export.lessons')} on={sections.lessons} onPress={() => toggle('lessons')} />
        <View style={[styles.sectionsSep, { backgroundColor: colors.hairline }]} />
        <SectionToggle label={t('export.debts')} on={sections.debts} onPress={() => toggle('debts')} />
      </Card>

      {done ? <Text style={[styles.exportDone, { color: colors.paid }]}>{t('export.done')}</Text> : null}

      <Pressable
        onPress={generate}
        style={({ pressed }) => [
          styles.generateBtn,
          { backgroundColor: colors.primary, borderRadius: radius.field },
          pressed && styles.pressed,
        ]}>
        <Icon name="share" size={19} sw={1.8} stroke={colors.onTint} />
        <Text style={[styles.generateText, { color: colors.onTint }]}>{t('export.generate')}</Text>
      </Pressable>
    </Sheet>
  );
}

/** A single «Раздел» row with a checkbox tick (export selector). */
function SectionToggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => [styles.sectionRow, pressed && styles.pressed]}>
      <Text style={[styles.sectionLabel, { color: colors.heading }]}>{label}</Text>
      <View
        style={[
          styles.checkbox,
          { backgroundColor: on ? colors.primary : colors.surface, borderColor: colors.hairline, borderWidth: on ? 0 : 1.5 },
        ]}>
        {on ? <Icon name="check" size={15} sw={2.2} stroke={colors.onTint} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * RU human label for a period — «Май 2026» / «2026» / «8 – 14 июня 2026». Reused for the
 * current period AND the Обзор comparison period (so both read the same way).
 */
function usePeriodLabel(): (p: Period) => string {
  const t = useT();
  return (p: Period) => {
    const start = new Date(p.start);
    if (p.type === 'month') return `${t(`month.${start.getMonth()}` as StringKey)} ${start.getFullYear()}`;
    if (p.type === 'year') return String(start.getFullYear());
    // week / custom — inclusive day range («end» is exclusive next-midnight → last day = end − 1).
    const last = new Date(p.end - 1);
    const dm = (ms: number) => {
      const d = new Date(ms);
      return `${d.getDate()} ${t(`monthGen.${d.getMonth()}` as StringKey)}`;
    };
    return `${dm(p.start)} – ${dm(last.getTime())} ${last.getFullYear()}`;
  };
}

const styles = StyleSheet.create({
  // top row
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 2 },
  periodBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, paddingVertical: 4 },
  periodText: { fontSize: 13, fontWeight: '500' },
  exportBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },

  // big metric
  metric: { fontSize: 38, fontWeight: '600', letterSpacing: -0.8, marginTop: 2, fontVariant: ['tabular-nums'] },

  // empty coverage
  emptyWrap: { alignItems: 'center', gap: 4 },
  resetBtn: { paddingVertical: 11, paddingHorizontal: 20, borderWidth: StyleSheet.hairlineWidth },
  resetText: { fontSize: 15, fontWeight: '500' },

  // body wrapper
  body: { gap: 20 },

  // cards — extra top room so a full-height bar's tap-tooltip clears the Card's overflow:hidden clip.
  chartCard: { paddingTop: 32, paddingHorizontal: 16, paddingBottom: 16 },
  kpiCard: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 4 },
  kpiSep: { width: StyleSheet.hairlineWidth, marginVertical: 2 },

  // donut (Структура дохода) — donut + legend rows (dot · name · pct · amount)
  donutCard: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 16 },
  donutCenter: { alignItems: 'center', paddingHorizontal: 4 },
  donutTotal: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  legend: { flex: 1, gap: 9 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 13 },
  legendPct: { fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  legendAmount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // bar rows (debtors)
  listCard: { paddingVertical: 4 },
  barRow: { paddingVertical: 13, paddingHorizontal: 14 },
  barRowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 10 },
  progressTrack: { height: 7, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },

  // debtor row specifics
  debtorName: { flex: 1, fontSize: 15, fontWeight: '500' },
  debtorAmountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  debtorAmount: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },

  // empty debts
  emptyDebtCard: { paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' },
  emptyDebtTitle: { fontSize: 15, fontWeight: '500' },
  emptyDebtSub: { fontSize: 14, marginTop: 6 },

  // comparison
  compareCard: { paddingVertical: 13, paddingHorizontal: 14 },
  compareSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareSelectorLabel: { fontSize: 14, fontWeight: '500' },
  compareSelectorValue: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  compareSelectorText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  compareResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  comparePill: { paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999 },
  comparePillText: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  compareVs: { fontSize: 13, fontWeight: '500' },
  compareInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareInfoText: { fontSize: 14, fontWeight: '500' },

  // insights (Выводы)
  insightsCard: { paddingVertical: 4 },
  insEmpty: { fontSize: 14, fontWeight: '500', paddingVertical: 14, paddingHorizontal: 14, textAlign: 'center' },
  insSep: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
  insRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 13, paddingHorizontal: 14 },
  insIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  insText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // export sheet
  exportLabel: { fontSize: 13, fontWeight: '500', marginBottom: 10, marginTop: 4 },
  formatRow: { flexDirection: 'row', gap: 9, marginBottom: 18 },
  formatCol: { flex: 1, alignItems: 'center', gap: 4 },
  formatBtn: { width: '100%', height: 46, alignItems: 'center', justifyContent: 'center' },
  formatText: { fontSize: 15, fontWeight: '500' },
  formatSoon: { fontSize: 11, fontWeight: '500' },
  sectionsCard: { paddingVertical: 2, marginBottom: 18 },
  sectionsSep: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14 },
  sectionLabel: { fontSize: 15 },
  checkbox: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  exportDone: { fontSize: 13, fontWeight: '500', marginBottom: 10, textAlign: 'center' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50 },
  generateText: { fontSize: 15, fontWeight: '500' },
});
