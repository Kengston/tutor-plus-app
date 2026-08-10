import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HeaderAction } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { plural, useT } from '@/i18n';
import { daySummary, payStatusOf } from '@/domain/aggregates';
import { daySegments, isBookableGap } from '@/domain/day-timeline';
import type { PayStatus } from '@/domain/types';
import { useAllTransactions, useLessonsInRange, useStudents } from '@/db/hooks';
import type { LessonModel, StudentModel } from '@/db/models';
import { formatRub } from '@/lib/format';
import { dayBounds, hhmm, nowMs } from '@/lib/time';
import { catColors, useTheme, type CatColor } from '@/theme';
import { Card, CatAvatar, Chip, Dot, type DotTone, Fab, Icon, PlusStroke, SectionLabel, Segmented, Sheet, Text, TextInput } from '@/ui';
import type { StringKey } from '@/i18n';

type ViewKind = 'calendar' | 'list';
type FormatFacet = 'all' | 'online' | 'inperson';
type PayFacet = 'all' | PayStatus;

/** Local-midnight ms for the day containing `ms` (calendar bucket key + day-cell id). */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local-midnight ms of the first day of `date`'s month. */
function startOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

/** Local-midnight ms of the first day of the month AFTER `date`'s month. */
function startOfNextMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
}

/** Mon-first weekday index (0=Mon … 6=Sun) for a JS getDay() (0=Sun … 6=Sat). */
function monIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/** PayStatus → Dot tone (paid→green, debt→red, expected→amber). */
const PAY_TONE: Record<PayStatus, DotTone> = { paid: 'green', debt: 'red', expected: 'amber' };

export default function ScheduleScreen() {
  const t = useT();
  const { colors, radius } = useTheme();
  const router = useRouter();

  const now = nowMs();
  const [view, setView] = useState<ViewKind>('calendar');
  // Month being viewed (any instant within it); only y/m matter.
  const [month, setMonth] = useState<Date>(() => new Date(nowMs()));
  // Selected day (local-midnight ms); defaults to today.
  const [selectedDay, setSelectedDay] = useState<number>(() => startOfDay(nowMs()));
  // Month/year picker sheet (spec 05 §5.1: tap on «Май 2026 ⌄»).
  const [pickingMonth, setPickingMonth] = useState(false);
  // Header search + filter (spec 05: «в шапке — поиск, фильтр»). The query matches the
  // student name or the topic; the facets narrow by format and payment status. Both apply
  // to the selected day's set on EITHER tab, so the glance, the feed and the list agree.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [fmtFacet, setFmtFacet] = useState<FormatFacet>('all');
  const [payFacet, setPayFacet] = useState<PayFacet>('all');

  // Deep-link from «Сегодня» («Все» / tomorrow card): ?view=list&day=<local-midnight ms>.
  // Applied once per NEW param value (prototype's initKey pattern) via the render-time
  // state-adjustment idiom (react.dev «storing information from previous renders») so
  // the user can freely change view/day afterwards without stale params snapping back.
  const params = useLocalSearchParams<{ view?: string; day?: string }>();
  const paramsKey = `${params.view ?? ''}|${params.day ?? ''}`;
  const [appliedKey, setAppliedKey] = useState('|');
  if (paramsKey !== '|' && paramsKey !== appliedKey) {
    setAppliedKey(paramsKey);
    if (params.view === 'list' || params.view === 'calendar') setView(params.view);
    const day = Number(params.day);
    if (Number.isFinite(day) && day > 0) {
      setSelectedDay(day);
      setMonth(new Date(day));
    }
  }

  const students = useStudents();
  const txns = useAllTransactions();
  const studentsById = useMemo(() => {
    const m = new Map<string, StudentModel>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  const todayStart = startOfDay(nowMs());

  // ── Calendar data: all lessons in the visible month, bucketed by local day. ──
  const monthStart = startOfMonth(month);
  const monthEnd = startOfNextMonth(month);
  const monthLessons = useLessonsInRange(monthStart, monthEnd);
  const lessonsByDay = useMemo(() => {
    const m = new Map<number, LessonModel[]>();
    for (const l of monthLessons) {
      const key = startOfDay(l.startsAt);
      const arr = m.get(key);
      if (arr) arr.push(l);
      else m.set(key, [l]);
    }
    return m;
  }, [monthLessons]);

  // Leading blanks (Mon-first) + day cells for the visible month.
  const monthCells = useMemo(() => {
    const first = new Date(monthStart);
    const lead = monIndex(first.getDay());
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), d).getTime());
    }
    return cells;
  }, [monthStart, month]);

  // ── List data: lessons of the selected day. ──
  const dayB = useMemo(() => dayBounds(selectedDay), [selectedDay]);
  const dayLessons = useLessonsInRange(dayB.start, dayB.end);

  const monthLabel = `${t(`month.${month.getMonth()}` as StringKey)} ${month.getFullYear()}`;
  const weekdayKeys: StringKey[] = ['wd.1', 'wd.2', 'wd.3', 'wd.4', 'wd.5', 'wd.6', 'wd.0'];

  const calLabel = t('schedule.calendar');
  const listLabel = t('schedule.list');

  const goMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const openLesson = (id: string) => router.push({ pathname: '/lesson/[id]', params: { id } });

  // Spec 05 §5.1: tapping a day shows its summary + feed UNDER the grid —
  // a composition on the Calendar tab, not a jump to the «Список» tab.
  const selectDay = (dayStart: number) => setSelectedDay(dayStart);

  // «Сегодня» — jump both the visible month and the selection back to now.
  const goToday = () => {
    setMonth(new Date(nowMs()));
    setSelectedDay(startOfDay(nowMs()));
  };

  // ── Selected-day summary + legend (calendar tab, spec 05 §5.1) ──
  // ONE visible set feeds both the summary numbers and the cards under the grid —
  // cancelled lessons are dropped from both, so «N уроков» can never disagree with
  // the feed (prototype: DayGlance counts the exact array the feed renders).
  const visibleDayLessons = useMemo(
    () => dayLessons.filter((l) => l.lifecycleStatus !== 'cancelled'),
    [dayLessons],
  );

  // Header search + filter narrow the visible set; everything downstream (glance, feed,
  // list) reads the SAME narrowed array, preserving the shared-set invariant above.
  const searching = query.trim().length > 0;
  const filtersActive = fmtFacet !== 'all' || payFacet !== 'all';
  const shownDayLessons = useMemo(() => {
    if (!searching && !filtersActive) return visibleDayLessons;
    const q = query.trim().toLowerCase();
    return visibleDayLessons.filter((l) => {
      if (fmtFacet !== 'all' && l.format !== fmtFacet) return false;
      if (payFacet !== 'all' && payStatusOf(l.id, txns) !== payFacet) return false;
      if (q) {
        const name = studentsById.get(l.studentId)?.name.toLowerCase() ?? '';
        const topic = l.topic?.toLowerCase() ?? '';
        if (!name.includes(q) && !topic.includes(q)) return false;
      }
      return true;
    });
  }, [visibleDayLessons, searching, filtersActive, query, fmtFacet, payFacet, txns, studentsById]);

  const summary = daySummary(shownDayLessons);
  const dayWord =
    selectedDay === todayStart
      ? t('schedule.today')
      : selectedDay === startOfDay(nowMs() + 86_400_000)
        ? t('common.tomorrow')
        : `${t(`wd.${new Date(selectedDay).getDay()}` as StringKey)}, ${new Date(selectedDay).getDate()} ${t(`monthGen.${new Date(selectedDay).getMonth()}` as StringKey)}`;
  const summaryLine2 =
    summary.total === 0
      ? null
      : `${summary.done} ${t('schedule.conducted')} · ${summary.nextAt !== null ? `${t('schedule.nextAt')} ${hhmm(summary.nextAt)}` : t('schedule.dayOver')}`;

  // Legend: one dot+name per student having lessons in the visible month.
  const legendStudents = useMemo(() => {
    const seen = new Set<string>();
    const out: StudentModel[] = [];
    for (const l of monthLessons) {
      if (seen.has(l.studentId)) continue;
      seen.add(l.studentId);
      const s = studentsById.get(l.studentId);
      if (s) out.push(s);
    }
    out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return out;
  }, [monthLessons, studentsById]);

  return (
    <Screen
      title={t('schedule.header')}
      actions={
        <>
          <HeaderAction
            icon="search"
            label={t('common.search')}
            active={searching || searchOpen}
            onPress={() => setSearchOpen((v) => !v || searching)}
          />
          <HeaderAction
            icon="filter"
            label={t('common.filter')}
            active={filtersActive}
            onPress={() => setFilterOpen(true)}
          />
        </>
      }
      floatingAction={<Fab onPress={() => router.push('/lesson/new')} />}>
      <Segmented
        tabs={[calLabel, listLabel]}
        active={view === 'calendar' ? calLabel : listLabel}
        onChange={(tab) => setView(tab === calLabel ? 'calendar' : 'list')}
      />

      {/* Search field — summoned from the header action; kept while a query is set. */}
      {searchOpen || searching ? (
        <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.control }]}>
          <Icon name="search" size={18} sw={1.8} stroke={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('schedule.search')}
            placeholderTextColor={colors.muted}
            autoFocus
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.heading }]}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.clearSearch')}>
              <Icon name="close" size={16} sw={2} stroke={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {view === 'calendar' ? (
        <>
          {/* Month row — CALENDAR tab only (spec 05 §5.1; «Список» keeps its own
              date heading and gets a date selector in slice #23): tappable
              «Июль 2026 ⌄» → month/year sheet; «Сегодня» + ‹ › on the right. */}
          <View style={styles.monthBar}>
            <Pressable
              onPress={() => setPickingMonth(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('schedule.pickMonth')}
              style={({ pressed }) => [styles.monthPick, pressed && styles.pressed]}>
              <Text style={[styles.monthLabel, { color: colors.heading }]}>{monthLabel}</Text>
              <Icon name="chevronDown" size={16} sw={1.8} stroke={colors.muted} />
            </Pressable>
            <View style={styles.monthNav}>
              <Pressable
                onPress={goToday}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('schedule.today')}
                style={({ pressed }) => [styles.todayBtn, { backgroundColor: colors.primaryVlight }, pressed && styles.pressed]}>
                <Text style={[styles.todayLabel, { color: colors.primary }]}>{t('schedule.today')}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t('a11y.prevMonth')}
                accessibilityRole="button"
                onPress={() => goMonth(-1)}
                hitSlop={8}
                style={({ pressed }) => [styles.arrow, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
                <Icon name="chevronLeft" size={18} sw={1.8} stroke={colors.heading} />
              </Pressable>
              <Pressable
                accessibilityLabel={t('a11y.nextMonth')}
                accessibilityRole="button"
                onPress={() => goMonth(1)}
                hitSlop={8}
                style={({ pressed }) => [styles.arrow, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
                <Icon name="chevronRight" size={18} sw={1.8} stroke={colors.heading} />
              </Pressable>
            </View>
          </View>

          <CalendarView
            cells={monthCells}
            weekdayLabels={weekdayKeys.map((k) => t(k))}
            lessonsByDay={lessonsByDay}
            studentsById={studentsById}
            todayStart={todayStart}
            selectedDay={selectedDay}
            onSelectDay={selectDay}
          />

          {/* Legend for the day-cell markers — student colours (xlsx v2.1). */}
          {legendStudents.length > 0 ? (
            <View style={styles.legend}>
              <Text style={[styles.legendTitle, { color: colors.muted }]}>{t('schedule.legend')}</Text>
              <View style={styles.legendItems}>
                {legendStudents.map((s) => (
                  <View key={s.id} style={styles.legendItem}>
                    <CatDot cat={s.category} />
                    <Text style={[styles.legendName, { color: colors.body }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Selected-day summary + feed UNDER the grid (spec 05 §5.1, DayGlance).
              Hidden for an empty day, as in the prototype (schedule.jsx:531). */}
          {summary.total > 0 ? (
            <View style={styles.glance}>
              <Text style={[styles.glanceTitle, { color: colors.heading }]}>
                {dayWord} · {summary.total}{' '}
                {plural(summary.total, {
                  one: t('unit.lessons.one'),
                  few: t('unit.lessons.few'),
                  many: t('unit.lessons.many'),
                })}
              </Text>
              {summaryLine2 ? (
                <Text style={[styles.glanceSub, { color: colors.muted }]}>{summaryLine2}</Text>
              ) : null}
            </View>
          ) : null}

          <SectionLabel>{t('schedule.day')}</SectionLabel>
          <DayFeed
            lessons={shownDayLessons}
            studentsById={studentsById}
            txns={txns}
            onOpen={openLesson}
            emptyText={
              (searching || filtersActive) && visibleDayLessons.length > 0
                ? t('schedule.searchEmpty')
                : t('schedule.dayEmpty')
            }
            formatLabel={(online) => t(online ? 'format.online' : 'format.inperson')}
            payLabel={(p) => t(payKey(p))}
          />
        </>
      ) : (
        <View style={styles.listWrap}>
          <View style={styles.dayHeading}>
            <Text style={[styles.dayHeadingText, { color: colors.heading }]}>
              {`${new Date(selectedDay).getDate()} ${t(`monthGen.${new Date(selectedDay).getMonth()}` as StringKey)}`}
            </Text>
            {shownDayLessons.length > 0 ? (
              <Text style={[styles.dayCount, { color: colors.muted }]}>
                {shownDayLessons.length}{' '}
                {plural(shownDayLessons.length, {
                  one: t('unit.lessons.one'),
                  few: t('unit.lessons.few'),
                  many: t('unit.lessons.many'),
                })}
              </Text>
            ) : null}
          </View>
          {searching || filtersActive ? (
            <DayFeed
              lessons={shownDayLessons}
              studentsById={studentsById}
              txns={txns}
              onOpen={openLesson}
              emptyText={visibleDayLessons.length > 0 ? t('schedule.searchEmpty') : t('schedule.dayEmpty')}
              formatLabel={(online) => t(online ? 'format.online' : 'format.inperson')}
              payLabel={(p) => t(payKey(p))}
            />
          ) : (
            <DayTimeline
              lessons={shownDayLessons}
              studentsById={studentsById}
              txns={txns}
              now={now}
              isToday={selectedDay === todayStart}
              onOpen={openLesson}
              onNewAt={(startsAt) => router.push({ pathname: '/lesson/new', params: { at: String(startsAt) } })}
            />
          )}
        </View>
      )}

      {filterOpen ? (
        <ScheduleFilterSheet
          fmt={fmtFacet}
          pay={payFacet}
          onFmt={setFmtFacet}
          onPay={setPayFacet}
          onReset={() => {
            setFmtFacet('all');
            setPayFacet('all');
          }}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}

      {pickingMonth ? (
        <MonthPickerSheet
          current={month}
          onClose={() => setPickingMonth(false)}
          onPick={(y, m) => {
            setMonth(new Date(y, m, 1));
            setPickingMonth(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

// ── Header filter sheet (spec 05: «фильтр») — format + payment facets ────────

const FMT_FACETS: { key: FormatFacet; label: StringKey }[] = [
  { key: 'all', label: 'filter.all' },
  { key: 'online', label: 'format.online' },
  { key: 'inperson', label: 'format.inperson' },
];
const PAY_FACETS: { key: PayFacet; label: StringKey }[] = [
  { key: 'all', label: 'filter.all' },
  { key: 'paid', label: 'pay.paid' },
  { key: 'debt', label: 'pay.debt' },
  { key: 'expected', label: 'pay.expected' },
];

function ScheduleFilterSheet({
  fmt,
  pay,
  onFmt,
  onPay,
  onReset,
  onClose,
}: {
  fmt: FormatFacet;
  pay: PayFacet;
  onFmt: (f: FormatFacet) => void;
  onPay: (p: PayFacet) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { colors, radius } = useTheme();
  return (
    <Sheet title={t('common.filter')} onClose={onClose}>
      <Text style={[styles.facetLabel, { color: colors.muted }]}>{t('field.format')}</Text>
      <FacetRow options={FMT_FACETS} current={fmt} onPick={onFmt} />
      <Text style={[styles.facetLabel, { color: colors.muted }]}>{t('schedule.filterPay')}</Text>
      <FacetRow options={PAY_FACETS} current={pay} onPick={onPay} />
      <Pressable
        onPress={() => {
          onReset();
          onClose();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.resetBtn, { backgroundColor: colors.stoneLight, borderRadius: radius.control }, pressed && styles.pressed]}>
        <Text style={[styles.resetLabel, { color: colors.heading }]}>{t('common.reset')}</Text>
      </Pressable>
    </Sheet>
  );
}

/** One facet chip row (mirrors the students-list pills). */
function FacetRow<K extends string>({
  options,
  current,
  onPick,
}: {
  options: { key: K; label: StringKey }[];
  current: K;
  onPick: (k: K) => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.facetRow}>
      {options.map((o) => {
        const on = o.key === current;
        return (
          <Pressable
            key={o.key}
            onPress={() => onPick(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.facetPill, { backgroundColor: on ? colors.primary : colors.stoneLight }]}>
            <Text style={[styles.facetPillLabel, { color: on ? colors.onTint : colors.body }]}>{t(o.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Month/year picker (spec 05 §5.1: tap on «Май 2026 ⌄») ────────────────────

function MonthPickerSheet({
  current,
  onClose,
  onPick,
}: {
  current: Date;
  onClose: () => void;
  onPick: (year: number, monthIdx: number) => void;
}) {
  const t = useT();
  const { colors, radius } = useTheme();
  const [year, setYear] = useState(current.getFullYear());

  return (
    <Sheet title={t('schedule.pickMonth')} onClose={onClose}>
      <View style={styles.yearRow}>
        <Pressable
          onPress={() => setYear((y) => y - 1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.prevYear')}
          style={({ pressed }) => [styles.arrow, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
          <Icon name="chevronLeft" size={18} sw={1.8} stroke={colors.heading} />
        </Pressable>
        <Text style={[styles.yearLabel, { color: colors.heading }]}>{year}</Text>
        <Pressable
          onPress={() => setYear((y) => y + 1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.nextYear')}
          style={({ pressed }) => [styles.arrow, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
          <Icon name="chevronRight" size={18} sw={1.8} stroke={colors.heading} />
        </Pressable>
      </View>
      <View style={styles.monthGrid}>
        {Array.from({ length: 12 }, (_, m) => {
          const active = year === current.getFullYear() && m === current.getMonth();
          return (
            <Pressable
              key={m}
              onPress={() => onPick(year, m)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.monthCell,
                { backgroundColor: active ? colors.primary : colors.stoneLight, borderRadius: radius.control },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.monthCellText, { color: active ? colors.onTint : colors.heading }]}>
                {t(`month.${m}` as StringKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

// ── Calendar grid ──────────────────────────────────────────────────────────

function CalendarView({
  cells,
  weekdayLabels,
  lessonsByDay,
  studentsById,
  todayStart,
  selectedDay,
  onSelectDay,
}: {
  cells: (number | null)[];
  weekdayLabels: string[];
  lessonsByDay: Map<number, LessonModel[]>;
  studentsById: Map<string, StudentModel>;
  todayStart: number;
  selectedDay: number;
  onSelectDay: (dayStart: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.calCard}>
      <View style={styles.weekRow}>
        {weekdayLabels.map((w, i) => (
          <Text
            key={w + i}
            style={[styles.weekday, { color: i >= 5 ? colors.label3 : colors.muted }]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (cell == null) return <View key={`b${i}`} style={styles.cell} />;
          const dayLessons = lessonsByDay.get(cell);
          const isToday = cell === todayStart;
          const isSelected = cell === selectedDay;
          const dayNum = new Date(cell).getDate();
          return (
            <Pressable
              key={cell}
              onPress={() => onSelectDay(cell)}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
              <View
                style={[
                  styles.dayNumWrap,
                  // Today keeps the primary circle (spec); any other selected day
                  // gets the prototype's marker — accent-soft fill + primary ring —
                  // so the under-grid feed has a readable anchor.
                  isToday && { backgroundColor: colors.primary },
                  !isToday && isSelected && [styles.daySelected, { backgroundColor: colors.accentSoft, borderColor: colors.primary }],
                ]}>
                <Text
                  style={[
                    styles.dayNum,
                    { color: isToday ? colors.onTint : colors.heading },
                    isToday && styles.dayNumToday,
                  ]}>
                  {dayNum}
                </Text>
              </View>
              <View style={styles.cellDots}>
                {dayLessons
                  ? dayLessons.slice(0, 4).map((l) => {
                      const cat = studentsById.get(l.studentId)?.category;
                      return <CatDot key={l.id} cat={cat} />;
                    })
                  : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/** Small category-coloured marker for a calendar day (kit Dot supports only tones). */
function CatDot({ cat }: { cat: CatColor | undefined }) {
  const color = cat ? catColors[cat].accent : catColors.slate.accent;
  return <View style={[styles.catDot, { backgroundColor: color }]} />;
}

// ── Day list ───────────────────────────────────────────────────────────────

interface DayFeedProps {
  lessons: LessonModel[];
  studentsById: Map<string, StudentModel>;
  txns: { type: PayStatus; lessonId: string | null }[];
  onOpen: (id: string) => void;
  emptyText: string;
  formatLabel: (online: boolean) => string;
  payLabel: (p: PayStatus) => string;
}

/** The selected day's lesson cards — shared by the Calendar composition (under the
 *  grid, spec 05 §5.1) and the «Список» tab (which adds its own date heading). */
function DayFeed({ lessons, studentsById, txns, onOpen, emptyText, formatLabel, payLabel }: DayFeedProps) {
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();

  if (lessons.length === 0) {
    return (
      <EmptyState
        mark="circle_date"
        text={emptyText}
        action={t('lesson.create')}
        onAction={() => router.push('/lesson/new')}
      />
    );
  }
  return (
    <View style={styles.listWrap}>
      {lessons.map((l) => {
        const student = studentsById.get(l.studentId);
        const cat: CatColor = student?.category ?? 'slate';
        const pay = payStatusOf(l.id, txns);
        return (
          <Card key={l.id} leftStrip={catColors[cat].accent} onPress={() => onOpen(l.id)}>
            <View style={styles.row}>
              <View style={styles.rowTime}>
                <Text style={[styles.timeText, { color: colors.heading }]}>{hhmm(l.startsAt)}</Text>
                <Text style={[styles.formatText, { color: colors.muted }]}>
                  {formatLabel(l.format === 'online')}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.heading }]}>
                  {student?.name ?? t('common.none')}
                </Text>
                {l.topic ? (
                  <Text numberOfLines={1} style={[styles.topic, { color: colors.muted }]}>
                    {l.topic}
                  </Text>
                ) : null}
              </View>
              <View style={styles.rowPay}>
                <Dot tone={PAY_TONE[pay]} />
                <Text style={[styles.payText, { color: colors.muted }]}>{payLabel(pay)}</Text>
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

// ── Day timeline (Список tab, spec 05 §5.2; prototype DayTimeline) ───────────

interface DayTimelineProps {
  lessons: LessonModel[];
  studentsById: Map<string, StudentModel>;
  txns: { type: PayStatus; lessonId: string | null }[];
  now: number;
  isToday: boolean;
  onOpen: (id: string) => void;
  /** Create a lesson prefilled at this instant (tap on a ≥60-min free window). */
  onNewAt: (startsAt: number) => void;
}

/** Whether a lesson's window contains `now` (drives the «Сейчас» state on today). */
function isNowLesson(l: LessonModel, now: number): boolean {
  return (
    l.lifecycleStatus !== 'done' &&
    l.lifecycleStatus !== 'cancelled' &&
    l.startsAt <= now &&
    now < l.startsAt + l.durationMin * 60_000
  );
}

/** The «Список» timeline: left time column + lesson cards + free-window gaps. */
function DayTimeline({ lessons, studentsById, txns, now, isToday, onOpen, onNewAt }: DayTimelineProps) {
  const t = useT();
  const { colors } = useTheme();

  if (lessons.length === 0) {
    return (
      <Card style={styles.freeDay}>
        <View style={[styles.freeDayIcon, { backgroundColor: colors.stoneLight }]}>
          <Icon name="calendar" size={19} sw={1.7} stroke={colors.stoneInactive} />
        </View>
        <View style={styles.freeDayBody}>
          <Text style={[styles.freeDayTitle, { color: colors.heading }]}>{t('schedule.freeDay')}</Text>
          <Text style={[styles.freeDayHint, { color: colors.muted }]}>{t('schedule.freeDayHint')}</Text>
        </View>
      </Card>
    );
  }

  const segs = daySegments(lessons);
  // Bookmark «сейчас» before the first still-active lesson (today only).
  const nowSegIdx = isToday
    ? segs.findIndex((s) => s.type === 'lesson' && s.lesson.lifecycleStatus !== 'done')
    : -1;

  return (
    <View>
      {segs.map((seg, i) => (
        <View key={seg.type === 'lesson' ? seg.lesson.id : `gap-${seg.start}`}>
          {i === nowSegIdx ? <NowBookmark label={t('schedule.now')} /> : null}
          <View style={styles.tlRow}>
            <Text style={[styles.tlTime, { color: seg.type === 'lesson' ? colors.stone700 : colors.stoneInactive }]}>
              {hhmm(seg.type === 'lesson' ? seg.lesson.startsAt : seg.start)}
            </Text>
            {seg.type === 'lesson' ? (
              <TimelineLesson
                lesson={seg.lesson}
                student={studentsById.get(seg.lesson.studentId)}
                pay={payStatusOf(seg.lesson.id, txns)}
                isNow={isNowLesson(seg.lesson, now)}
                onPress={() => onOpen(seg.lesson.id)}
              />
            ) : (
              <TimelineGap seg={seg} onNew={isBookableGap(seg) ? () => onNewAt(seg.start) : undefined} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/** «сейчас» marker line before the current/next lesson. */
function NowBookmark({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.nowRow}>
      <Text style={[styles.nowLabel, { color: colors.terracotta }]}>{label}</Text>
      <View style={[styles.nowDot, { backgroundColor: colors.terracotta }]} />
      <View style={[styles.nowLine, { backgroundColor: colors.terracotta }]} />
    </View>
  );
}

/** One lesson card in the timeline — strip colour + status per pay/lifecycle. */
function TimelineLesson({
  lesson,
  student,
  pay,
  isNow,
  onPress,
}: {
  lesson: LessonModel;
  student: StudentModel | undefined;
  pay: PayStatus;
  isNow: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const { colors, radius } = useTheme();
  const cat: CatColor = student?.category ?? 'slate';
  const isDone = lesson.lifecycleStatus === 'done';
  const isDebt = pay === 'debt';
  // Strip + card tint (prototype TimelineLesson): now → accent, debt → danger, else cat.
  const strip = isNow ? colors.accent : isDebt ? colors.danger : catColors[cat].accent;
  const bg = isNow ? colors.primaryVlight : isDebt ? colors.dangerLight : colors.surface;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tlCard,
        { backgroundColor: bg, borderColor: colors.hairline, borderLeftColor: strip, borderRadius: radius.row, opacity: isDone && !pressed ? 0.9 : 1 },
        pressed && styles.pressed,
      ]}>
      <CatAvatar initials={student?.initials ?? '—'} cat={cat} size={38} />
      <View style={styles.tlBody}>
        <View style={styles.tlNameRow}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.heading }]}>
            {student?.name ?? t('common.none')}
          </Text>
          {isDebt ? (
            <Chip tone="danger">{`${t('schedule.debtAmount')} ${formatRub(lesson.price)}`}</Chip>
          ) : isNow ? (
            <Chip tone="primary">{t('schedule.now')}</Chip>
          ) : isDone ? (
            <Chip tone="neutral">{t('status.conducted')}</Chip>
          ) : (
            <Dot tone={pay === 'paid' ? 'green' : 'amber'} />
          )}
        </View>
        {lesson.topic ? (
          <Text numberOfLines={1} style={[styles.topic, { color: colors.body }]}>
            {lesson.topic}
          </Text>
        ) : null}
        <View style={styles.tlMeta}>
          <Icon name={lesson.format === 'online' ? 'video' : 'pin'} size={12} sw={1.8} stroke={colors.muted} />
          <Text style={[styles.tlMetaText, { color: colors.muted }]}>
            {t(lesson.format === 'online' ? 'format.online' : 'format.inperson')}
          </Text>
          <View style={[styles.tlMetaDot, { backgroundColor: colors.label3 }]} />
          <Text style={[styles.tlMetaText, { color: colors.muted }]}>
            {lesson.durationMin} {t('common.min')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** A free window between lessons — bookable (≥60 min, dashed CTA) or a thin divider. */
function TimelineGap({ seg, onNew }: { seg: { mins: number }; onNew?: () => void }) {
  const t = useT();
  const { colors, radius } = useTheme();
  const label = `${durLabel(seg.mins, t)} ${t('schedule.freeWindow')}`;

  if (onNew) {
    return (
      <Pressable
        onPress={onNew}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.gapBookable,
          { borderColor: colors.stoneInactive, borderRadius: radius.row },
          pressed && styles.pressed,
        ]}>
        <View style={[styles.gapPlus, { backgroundColor: colors.surface, borderColor: colors.stoneInactive }]}>
          {/* Жест «добавить» — рукописный росчерк (канон §10, слайс #75). */}
          <PlusStroke size="marker" px={17} color={colors.primaryDeep} />
        </View>
        <Text style={[styles.gapLabel, { color: colors.muted }]}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.gapThin}>
      <Text style={[styles.gapThinText, { color: colors.stoneInactive }]}>{label}</Text>
      <View style={[styles.gapThinLine, { backgroundColor: colors.hairline }]} />
    </View>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function payKey(p: PayStatus): StringKey {
  return p === 'paid' ? 'pay.paid' : p === 'debt' ? 'pay.debt' : 'pay.expected';
}

/** «1 ч 30 мин» / «1 ч» / «30 мин» from minutes (prototype durLabel; units via i18n). */
function durLabel(min: number, t: ReturnType<typeof useT>): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ${t('common.hour')} ${m} ${t('common.min')}`;
  if (h) return `${h} ${t('common.hour')}`;
  return `${m} ${t('common.min')}`;
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  monthPick: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  // header search + filter (spec 05, UI-v2 S18)
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
  facetLabel: { fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 10, marginBottom: 8 },
  facetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  facetPill: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999 },
  facetPillLabel: { fontSize: 13.5, fontWeight: '600' },
  resetBtn: { marginTop: 18, height: 48, alignItems: 'center', justifyContent: 'center' },
  resetLabel: { fontSize: 15, fontWeight: '600' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  todayLabel: { fontSize: 13, fontWeight: '600' },
  arrow: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  pressed: { opacity: 0.7 },

  // legend (day-marker colours = student colours)
  legend: { paddingHorizontal: 4, gap: 6 },
  legendTitle: { fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  legendItems: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendName: { fontSize: 12.5, fontWeight: '500' },

  // selected-day summary (DayGlance)
  glance: { paddingHorizontal: 4, gap: 3 },
  glanceTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  glanceSub: { fontSize: 13, fontWeight: '500' },

  // month/year picker sheet
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  yearLabel: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: { width: '31.5%', paddingVertical: 13, alignItems: 'center' },
  monthCellText: { fontSize: 14, fontWeight: '600' },

  // calendar
  calCard: { padding: 12 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  dayNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  daySelected: { borderWidth: 1.5 },
  dayNum: { fontSize: 14, fontWeight: '500' },
  dayNumToday: { fontWeight: '700' },
  cellDots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 6, alignItems: 'center' },
  catDot: { width: 5, height: 5, borderRadius: 2.5 },

  // list
  listWrap: { gap: 10 },
  dayHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 },
  dayHeadingText: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  dayCount: { fontSize: 13, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowTime: { width: 56 },
  timeText: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  formatText: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  rowBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  topic: { fontSize: 13, marginTop: 2 },
  rowPay: { alignItems: 'center', gap: 4, width: 64 },
  payText: { fontSize: 11, fontWeight: '500' },

  // day timeline (Список tab, spec 05 §5.2)
  tlRow: { flexDirection: 'row', gap: 10 },
  tlTime: { width: 42, textAlign: 'right', fontSize: 12.5, fontWeight: '500', fontVariant: ['tabular-nums'] },
  tlCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
    padding: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
  },
  tlBody: { flex: 1, minWidth: 0 },
  tlNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tlMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  tlMetaText: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  tlMetaDot: { width: 3, height: 3, borderRadius: 1.5 },

  // «сейчас» bookmark
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingTop: 2 },
  nowLabel: { width: 42, textAlign: 'right', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  nowLine: { flex: 1, height: 2, borderRadius: 2, opacity: 0.5 },

  // free window
  gapBookable: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  gapPlus: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  gapThin: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingVertical: 7 },
  gapThinText: { fontSize: 12.5, fontWeight: '500' },
  gapThinLine: { flex: 1, height: StyleSheet.hairlineWidth },

  // free day
  freeDay: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  freeDayIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  freeDayBody: { flex: 1, minWidth: 0 },
  freeDayTitle: { fontSize: 14.5, fontWeight: '600' },
  freeDayHint: { fontSize: 12.5, fontWeight: '500', marginTop: 2 },
});
