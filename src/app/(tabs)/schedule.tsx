import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { plural, useT } from '@/i18n';
import { payStatusOf } from '@/domain/aggregates';
import type { PayStatus } from '@/domain/types';
import { useAllTransactions, useLessonsInRange, useStudents } from '@/db/hooks';
import type { LessonModel, StudentModel } from '@/db/models';
import { dayBounds, hhmm, nowMs } from '@/lib/time';
import { catColors, useTheme, type CatColor } from '@/theme';
import { Card, Dot, Fab, Icon, Segmented, type DotTone } from '@/ui';
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

  const selectDay = (dayStart: number) => {
    setSelectedDay(dayStart);
    setView('list');
  };

  return (
    <Screen
      title={t('schedule.title')}
      floatingAction={<Fab onPress={() => router.push('/lesson/new')} />}>
      <Segmented
        tabs={[calLabel, listLabel]}
        active={view === 'calendar' ? calLabel : listLabel}
        onChange={(tab) => setView(tab === calLabel ? 'calendar' : 'list')}
      />

      {/* Month navigator */}
      <View style={styles.monthBar}>
        <Pressable
          accessibilityLabel={t('common.back')}
          onPress={() => goMonth(-1)}
          hitSlop={8}
          style={({ pressed }) => [styles.arrow, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
          <Icon name="chevronLeft" size={18} sw={1.8} stroke={colors.heading} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: colors.heading }]}>{monthLabel}</Text>
        <Pressable
          accessibilityLabel={t('common.add')}
          onPress={() => goMonth(1)}
          hitSlop={8}
          style={({ pressed }) => [styles.arrow, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
          <Icon name="chevronRight" size={18} sw={1.8} stroke={colors.heading} />
        </Pressable>
      </View>

      {view === 'calendar' ? (
        <CalendarView
          cells={monthCells}
          weekdayLabels={weekdayKeys.map((k) => t(k))}
          lessonsByDay={lessonsByDay}
          studentsById={studentsById}
          todayStart={todayStart}
          onSelectDay={selectDay}
        />
      ) : (
        <ListView
          lessons={dayLessons}
          studentsById={studentsById}
          txns={txns}
          dayLabel={`${new Date(selectedDay).getDate()} ${t(`month.${new Date(selectedDay).getMonth()}` as StringKey)}`}
          onOpen={openLesson}
          emptyText={t('schedule.dayEmpty')}
          formatLabel={(online) => t(online ? 'format.online' : 'format.inperson')}
          payLabel={(p) => t(payKey(p))}
        />
      )}

    </Screen>
  );
}

// ── Calendar grid ──────────────────────────────────────────────────────────

function CalendarView({
  cells,
  weekdayLabels,
  lessonsByDay,
  studentsById,
  todayStart,
  onSelectDay,
}: {
  cells: (number | null)[];
  weekdayLabels: string[];
  lessonsByDay: Map<number, LessonModel[]>;
  studentsById: Map<string, StudentModel>;
  todayStart: number;
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
          const dayNum = new Date(cell).getDate();
          return (
            <Pressable
              key={cell}
              onPress={() => onSelectDay(cell)}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
              <View
                style={[
                  styles.dayNumWrap,
                  isToday && { backgroundColor: colors.primary },
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

function ListView({
  lessons,
  studentsById,
  txns,
  dayLabel,
  onOpen,
  emptyText,
  formatLabel,
  payLabel,
}: {
  lessons: LessonModel[];
  studentsById: Map<string, StudentModel>;
  txns: { type: PayStatus; lessonId: string | null }[];
  dayLabel: string;
  onOpen: (id: string) => void;
  emptyText: string;
  formatLabel: (online: boolean) => string;
  payLabel: (p: PayStatus) => string;
}) {
  const t = useT();
  const { colors } = useTheme();

  return (
    <View style={styles.listWrap}>
      <View style={styles.dayHeading}>
        <Text style={[styles.dayHeadingText, { color: colors.heading }]}>{dayLabel}</Text>
        {lessons.length > 0 && (
          <Text style={[styles.dayCount, { color: colors.muted }]}>
            {lessons.length}{' '}
            {plural(lessons.length, {
              one: t('unit.lessons.one'),
              few: t('unit.lessons.few'),
              many: t('unit.lessons.many'),
            })}
          </Text>
        )}
      </View>

      {lessons.length === 0 ? (
        <EmptyState icon="calendar" text={emptyText} />
      ) : (
        lessons.map((l) => {
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
        })
      )}
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
  arrow: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  pressed: { opacity: 0.7 },

  // calendar
  calCard: { padding: 12 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  dayNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
