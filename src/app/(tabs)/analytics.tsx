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
  activeStudentsInPeriod,
  avgCheckInPeriod,
  cancellationsInPeriod,
  debtors,
  dynamicsHighlight,
  entriesInPeriod,
  financeEntries,
  incomeByFormat,
  incomeByStudent,
  incomeInPeriod,
  lessonsConductedInPeriod,
  metricDelta,
  overviewInsights,
  paidByBucket,
  subjectTotals,
  topDirections,
  type OverviewInsight,
} from '@/domain/aggregates';
import { useT, type StringKey } from '@/i18n';
import { downloadCsv, toCsv } from '@/lib/csv';
import { formatNumberRu, formatRub } from '@/lib/format';
import {
  currentMonth,
  monthOf,
  monthStarts,
  periodQuarters,
  shiftPeriod,
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
  LineCompareChart,
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
          {/* Big metric — animated (Обзор only; Динамика owns its metric headline inside). */}
          {tab === 'overview' ? (
            <CountUp value={incomeNow} format={(v) => formatRub(v)} style={StyleSheet.flatten([styles.metric, { color: colors.heading }])} />
          ) : null}

          {tab === 'overview' ? (
            <OverviewBody
              lessons={lessons}
              txns={txns}
              period={period}
              subjectName={subjectName}
              studentName={studentName}
            />
          ) : (
            <DynamicsBody lessons={lessons} txns={txns} period={period} />
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
  // Name the ACTUAL comparison period (concrete «Июнь 2026», not the generic «Предыдущий период»).
  const compareLabel = hasBaseline ? periodLabelOf(comparePeriod) : t('common.none');

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

/** The three Dynamics metrics (spec 08 §8.2) — a stable key; labels/formatting at render. */
type DynMetric = 'lessons' | 'income' | 'students';

function DynamicsBody({
  lessons,
  txns,
  period,
}: {
  lessons: LessonModel[];
  txns: Parameters<typeof topDirections>[1];
  period: Period;
}) {
  const t = useT();
  const { colors, radius } = useTheme();
  const periodLabelOf = usePeriodLabel();

  const [metric, setMetric] = useState<DynMetric>('lessons');

  // Comparison period — same selectable pattern as Обзор (custom main range has no default baseline).
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareCustom, setCompareCustom] = useState<Period | null>(null);
  const comparePeriod = compareCustom ?? shiftPeriod(period, -1);
  const hasBaseline = compareCustom != null || period.type !== 'custom';

  // One evaluator for «metric over a period» — reused for totals AND the 4 chart sub-ranges.
  const metricInPeriod = (m: DynMetric, p: Period): number =>
    m === 'income' ? incomeInPeriod(txns, p) : m === 'lessons' ? lessonsConductedInPeriod(lessons, p) : activeStudentsInPeriod(lessons, p);

  const totals: Record<DynMetric, number> = {
    lessons: metricInPeriod('lessons', period),
    income: metricInPeriod('income', period),
    students: metricInPeriod('students', period),
  };
  const prevTotal = hasBaseline ? metricInPeriod(metric, comparePeriod) : 0;
  const delta = metricDelta(totals[metric], prevTotal);

  // Line-chart series: the same metric over 4 aligned sub-ranges of each period (spec §8.2).
  const quarters = periodQuarters(period);
  const cur = quarters.map((q) => metricInPeriod(metric, q));
  const prev = hasBaseline ? periodQuarters(comparePeriod).map((q) => metricInPeriod(metric, q)) : null;
  // Sub-range labels follow the MAIN period's type: month/week/custom → day ranges («1–7»,
  // day-aligned so they never overlap); year → calendar-quarter month ranges («Янв–Мар»).
  // These feed the axis, the point tooltip header AND the «ГЛАВНОЕ ЗА ПЕРИОД» text.
  const qLabel = (q: Period): string => {
    if (q.end <= q.start) return String(new Date(q.start).getDate()); // degenerate <4-day chunk
    if (period.type === 'year') {
      const a = t(`month.${new Date(q.start).getMonth()}` as StringKey).slice(0, 3);
      const b = t(`month.${new Date(q.end - 1).getMonth()}` as StringKey).slice(0, 3);
      return a === b ? a : `${a}–${b}`;
    }
    const d1 = new Date(q.start).getDate();
    const d2 = new Date(q.end - 1).getDate();
    return d1 === d2 ? String(d1) : `${d1}–${d2}`;
  };
  const labels = quarters.map(qLabel);

  const isMoney = metric === 'income';
  const fmt = (n: number) => (isMoney ? formatRub(n) : formatNumberRu(n));
  const fmtAxis = (n: number) => (isMoney ? shortRub(Math.round(n)).replace(' ₽', '') : String(Math.round(n)));

  const METRIC_LABEL: Record<DynMetric, string> = {
    lessons: t('dyn.mLessons'),
    income: t('dyn.mIncome'),
    students: t('dyn.mStudents'),
  };

  // «ГЛАВНОЕ ЗА ПЕРИОД» — the sub-range with the largest divergence (null → empty state).
  const highlight = prev ? dynamicsHighlight(cur, prev) : null;

  // Name the ACTUAL comparison period (spec §8.2 — «Сравнение с апрелем 2026», легенда «Май / Апрель»),
  // not the generic «Предыдущий период»; no baseline (custom main, nothing picked) → «—».
  const compareLabel = hasBaseline ? periodLabelOf(comparePeriod) : t('common.none');
  const good = delta.dir === 'up' || delta.dir === 'flat';

  return (
    <View style={styles.body}>
      {/* Metric selector — each segment shows its label + total; active is raised. */}
      <View style={[styles.dynSelector, { backgroundColor: colors.stoneLight, borderRadius: radius.field }]}>
        {(['lessons', 'income', 'students'] as const).map((m) => {
          const on = m === metric;
          return (
            <Pressable
              key={m}
              onPress={() => setMetric(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.dynSegment,
                { borderRadius: radius.field - 4 },
                on && { backgroundColor: colors.surface },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.dynSegLabel, { color: on ? colors.heading : colors.muted }]} numberOfLines={1}>
                {METRIC_LABEL[m]}
              </Text>
              <Text style={[styles.dynSegValue, { color: colors.heading }]} numberOfLines={1}>
                {m === 'income' ? formatRub(totals[m]) : formatNumberRu(totals[m])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Headline: selected metric value + delta badge + plain-words comparison line. */}
      <Card style={styles.dynHeadCard}>
        <View style={styles.dynHeadRow}>
          <Text style={[styles.dynHeadValue, { color: colors.heading }]}>{fmt(totals[metric])}</Text>
          {delta.pct !== null ? (
            <View style={[styles.comparePill, { backgroundColor: good ? colors.accentSoft : colors.dangerLight }]}>
              <Text style={[styles.comparePillText, { color: good ? colors.heading : colors.danger }]}>
                {`${delta.pct > 0 ? '+' : ''}${delta.pct}%`}
              </Text>
            </View>
          ) : null}
        </View>
        {delta.pct !== null ? (
          <Text style={[styles.dynHeadSub, { color: colors.muted }]}>
            {`${t('dyn.by')} ${isMoney ? formatRub(Math.abs(delta.abs)) : formatNumberRu(Math.abs(delta.abs))} ${
              delta.abs >= 0 ? t('dyn.deltaMore') : t('dyn.deltaLess')
            } — ${t('dyn.was')} ${fmt(prevTotal)}`}
          </Text>
        ) : (
          <View style={styles.compareInfoRow}>
            <Icon name="info" size={15} sw={1.8} stroke={colors.muted} />
            <Text style={[styles.compareInfoText, { color: colors.muted }]}>{t('analytics.noCompare')}</Text>
          </View>
        )}

        {/* Compare-period selector (opens the shared PeriodSheet). */}
        <Pressable
          onPress={() => setCompareOpen(true)}
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => [styles.dynCompareRow, pressed && styles.pressed]}>
          <Text style={[styles.dynCompareText, { color: colors.muted }]} numberOfLines={1}>
            {`${t('analytics.comparePick')}: ${compareLabel}`}
          </Text>
          <Icon name="chevronDown" size={13} sw={1.9} stroke={colors.primary} />
        </Pressable>

        {/* Comparative line chart — solid current / dashed comparison; `key` resets the
            tapped point when the metric switches (values change meaning). */}
        <LineCompareChart
          key={metric}
          labels={labels}
          current={cur}
          compare={prev}
          height={168}
          formatValue={fmt}
          formatAxis={fmtAxis}
          legendCurrent={periodLabelOf(period)}
          legendCompare={hasBaseline ? compareLabel : undefined}
          diffLabel={t('dyn.diff')}
        />
      </Card>

      {/* «ГЛАВНОЕ ЗА ПЕРИОД» — auto-highlight from the same series (or a correct empty state). */}
      <View>
        <SectionLabel>{t('dyn.highlight')}</SectionLabel>
        <Card style={styles.insightsCard}>
          {highlight ? (
            <View style={styles.insRow}>
              <View style={[styles.insIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon name="sparkle" size={14} sw={1.8} stroke={colors.heading} />
              </View>
              <Text style={[styles.insText, { color: colors.body }]}>
                {`${highlight.dir === 'up' ? t('dyn.hlGrowth') : t('dyn.hlDecline')} ${labels[highlight.quarter]}: ${t('dyn.hlBy')} ${
                  isMoney ? formatRub(highlight.diff) : formatNumberRu(highlight.diff)
                } ${highlight.dir === 'up' ? t('dyn.hlMoreTail') : t('dyn.hlLessTail')}`}
              </Text>
            </View>
          ) : (
            <Text style={[styles.insEmpty, { color: colors.muted }]}>{t('dyn.hlEmpty')}</Text>
          )}
        </Card>
      </View>

      {/* Compare-period picker (arbitrary period via the shared sheet). */}
      <PeriodSheet
        visible={compareOpen}
        period={comparePeriod}
        onClose={() => setCompareOpen(false)}
        onApply={(p) => setCompareCustom(p)}
      />
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

  // Динамика: metric selector + headline + compare row
  dynSelector: { flexDirection: 'row', gap: 4, padding: 4 },
  dynSegment: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 6, gap: 4 },
  dynSegLabel: { fontSize: 11.5, fontWeight: '500' },
  dynSegValue: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  dynHeadCard: { paddingVertical: 16, paddingHorizontal: 16 },
  dynHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dynHeadValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  dynHeadSub: { fontSize: 13, marginTop: 7, lineHeight: 18 },
  dynCompareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12, marginBottom: 10 },
  dynCompareText: { fontSize: 12.5, fontWeight: '500' },

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
