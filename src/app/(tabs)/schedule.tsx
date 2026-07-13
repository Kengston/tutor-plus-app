import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { plural, useT } from '@/i18n';
import { daySummary, payStatusOf } from '@/domain/aggregates';
import type { PayStatus } from '@/domain/types';
import { useAllTransactions, useLessonsInRange, useStudents } from '@/db/hooks';
import type { LessonModel, StudentModel } from '@/db/models';
import { dayBounds, hhmm, nowMs } from '@/lib/time';
import { catColors, useTheme, type CatColor } from '@/theme';
import { Card, Dot, Fab, Icon, SectionLabel, Segmented, Sheet, type DotTone } from '@/ui';
import type { StringKey } from '@/i18n';

type ViewKind = 'calendar' | 'list';

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
  const { colors } = useTheme();
  const router = useRouter();

  const [view, setView] = useState<ViewKind>('calendar');
  // Month being viewed (any instant within it); only y/m matter.
  const [month, setMonth] = useState<Date>(() => new Date(nowMs()));
  // Selected day (local-midnight ms); defaults to today.
  const [selectedDay, setSelectedDay] = useState<number>(() => startOfDay(nowMs()));
  // Month/year picker sheet (spec 05 §5.1: tap on «Май 2026 ⌄»).
  const [pickingMonth, setPickingMonth] = useState(false);

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
  const summary = daySummary(visibleDayLessons);
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
      floatingAction={<Fab onPress={() => router.push('/lesson/new')} />}>
      <Segmented
        tabs={[calLabel, listLabel]}
        active={view === 'calendar' ? calLabel : listLabel}
        onChange={(tab) => setView(tab === calLabel ? 'calendar' : 'list')}
      />

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
            lessons={visibleDayLessons}
            studentsById={studentsById}
            txns={txns}
            onOpen={openLesson}
            emptyText={t('schedule.dayEmpty')}
            formatLabel={(online) => t(online ? 'format.online' : 'format.inperson')}
            payLabel={(p) => t(payKey(p))}
          />
        </>
      ) : (
        <ListView
          lessons={dayLessons}
          studentsById={studentsById}
          txns={txns}
          dayLabel={`${new Date(selectedDay).getDate()} ${t(`monthGen.${new Date(selectedDay).getMonth()}` as StringKey)}`}
          onOpen={openLesson}
          emptyText={t('schedule.dayEmpty')}
          formatLabel={(online) => t(online ? 'format.online' : 'format.inperson')}
          payLabel={(p) => t(payKey(p))}
        />
      )}

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

  if (lessons.length === 0) return <EmptyState icon="calendar" text={emptyText} />;
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

function ListView({
  dayLabel,
  ...feed
}: DayFeedProps & { dayLabel: string }) {
  const t = useT();
  const { colors } = useTheme();

  return (
    <View style={styles.listWrap}>
      <View style={styles.dayHeading}>
        <Text style={[styles.dayHeadingText, { color: colors.heading }]}>{dayLabel}</Text>
        {feed.lessons.length > 0 && (
          <Text style={[styles.dayCount, { color: colors.muted }]}>
            {feed.lessons.length}{' '}
            {plural(feed.lessons.length, {
              one: t('unit.lessons.one'),
              few: t('unit.lessons.few'),
              many: t('unit.lessons.many'),
            })}
          </Text>
        )}
      </View>
      <DayFeed {...feed} />
    </View>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function payKey(p: PayStatus): StringKey {
  return p === 'paid' ? 'pay.paid' : p === 'debt' ? 'pay.debt' : 'pay.expected';
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
  name: { fontSize: 15, fontWeight: '600' },
  topic: { fontSize: 13, marginTop: 2 },
  rowPay: { alignItems: 'center', gap: 4, width: 64 },
  payText: { fontSize: 11, fontWeight: '500' },
});
