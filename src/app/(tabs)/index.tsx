import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateTimePickerSheet } from '@/components/DateTimePickerSheet';
import { Screen } from '@/components/Screen';
import { payStatusOf, doneOfTotal } from '@/domain/aggregates';
import type { LessonModel, StudentModel } from '@/db/models';
import { useAllTransactions, useLessonsInRange, useStudents } from '@/db/hooks';
import { cancelLesson, markLessonConducted, rescheduleLesson } from '@/db/mutations';
import { plural, useT } from '@/i18n';
import { dayBounds, dayBoundsOffset, fracOfDay, hhmm, minutesUntil, nowMs } from '@/lib/time';
import { catColors, useTheme } from '@/theme';
import {
  Card,
  CatAvatar,
  DayLane,
  Dot,
  Fab,
  Icon,
  Ring,
  SectionLabel,
  SwipeRow,
  type DotTone,
} from '@/ui';

/** Minutes phrasing forms for `plural()` — composed once per render via t(). */
function minuteForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.minutes.one'), few: t('unit.minutes.few'), many: t('unit.minutes.many') };
}

/** Lessons phrasing forms (mode-aware). */
function lessonForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.lessons.one'), few: t('unit.lessons.few'), many: t('unit.lessons.many') };
}

/** Derived lesson pay-status → Dot tone. */
const DOT_TONE: Record<'paid' | 'debt' | 'expected', DotTone> = {
  paid: 'green',
  debt: 'red',
  expected: 'amber',
};

export default function TodayScreen() {
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();

  const { start, end } = dayBounds();
  const lessons = useLessonsInRange(start, end);
  const txns = useAllTransactions();
  const students = useStudents();

  const now = nowMs();

  // Reschedule target — the lesson whose date/time the picker sheet is editing.
  const [reschedulingLesson, setReschedulingLesson] = useState<LessonModel | null>(null);

  const studentsById = useMemo(() => {
    const m = new Map<string, StudentModel>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  const { done, total } = doneOfTotal(lessons);

  // Today's still-active lessons from now on (sorted ascending by the hook).
  const upcomingToday = lessons.filter(
    (l) =>
      l.startsAt >= now && (l.lifecycleStatus === 'upcoming' || l.lifecycleStatus === 'ongoing'),
  );
  const nearest = upcomingToday[0];

  const laneItems = lessons.map((l) => ({
    frac: fracOfDay(l.startsAt),
    cat: studentsById.get(l.studentId)?.category,
    done: l.lifecycleStatus === 'done',
  }));

  const tb = dayBoundsOffset(1);
  const tomorrow = useLessonsInRange(tb.start, tb.end);
  const tomorrowCount = tomorrow.length;

  return (
    <Screen
      title={t('today.greeting')}
      floatingAction={<Fab onPress={() => router.push('/lesson/new')} />}>
      {/* Progress ring + day timeline */}
      <Card style={styles.hero}>
        <View style={styles.ringWrap}>
          <Ring
            progress={total ? done / total : 0}
            centerTop={
              <Text style={[styles.ringTop, { color: colors.heading }]}>
                {done}/{total}
              </Text>
            }
            centerSub={<Text style={[styles.ringSub, { color: colors.muted }]}>{t('today.progress')}</Text>}
          />
        </View>
        <DayLane items={laneItems} nowFrac={fracOfDay(now)} />
      </Card>

      {/* Nearest lesson */}
      {nearest ? (
        <NearestCard lesson={nearest} student={studentsById.get(nearest.studentId)} now={now} />
      ) : null}

      {/* Далее сегодня */}
      <View>
        <SectionLabel>{t('today.next')}</SectionLabel>
        {upcomingToday.length === 0 ? (
          <View style={[styles.emptyNext, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.emptyNextText, { color: colors.muted }]}>{t('today.nothingNext')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {upcomingToday.map((l) => (
              <View key={l.id} style={[styles.rowShell, { borderColor: colors.hairline, borderRadius: 16 }]}>
                <SwipeRow
                  leftActions={[
                    {
                      label: t('action.conduct'),
                      color: colors.paid,
                      icon: 'check',
                      onPress: () => {
                        void markLessonConducted(l);
                      },
                    },
                  ]}
                  rightActions={[
                    {
                      label: t('action.reschedule'),
                      color: colors.warning,
                      icon: 'refresh',
                      onPress: () => {
                        setReschedulingLesson(l);
                      },
                    },
                    {
                      label: t('action.cancel'),
                      color: colors.danger,
                      icon: 'close',
                      onPress: () => {
                        void cancelLesson(l, t('action.cancel'));
                      },
                    },
                  ]}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: l.id } })}
                    style={styles.lessonRow}>
                    <Text style={[styles.rowTime, { color: colors.heading }]}>{hhmm(l.startsAt)}</Text>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowName, { color: colors.heading }]} numberOfLines={1}>
                        {studentsById.get(l.studentId)?.name ?? t('common.none')}
                      </Text>
                      {l.topic ? (
                        <Text style={[styles.rowTopic, { color: colors.muted }]} numberOfLines={1}>
                          {l.topic}
                        </Text>
                      ) : null}
                    </View>
                    <Dot tone={DOT_TONE[payStatusOf(l.id, txns)]} />
                  </Pressable>
                </SwipeRow>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Tomorrow preview */}
      <Text style={[styles.tomorrow, { color: colors.muted }]}>
        {t('today.tomorrowPreview')} · {tomorrowCount} {plural(tomorrowCount, lessonForms(t))}
      </Text>

      <DateTimePickerSheet
        visible={reschedulingLesson !== null}
        initial={reschedulingLesson?.startsAt}
        title={t('action.reschedule')}
        onClose={() => setReschedulingLesson(null)}
        onPick={(ms) => {
          if (reschedulingLesson) void rescheduleLesson(reschedulingLesson, ms);
        }}
      />
    </Screen>
  );
}

/** Inline nearest-lesson hero card. */
function NearestCard({
  lesson,
  student,
  now,
}: {
  lesson: LessonModel;
  student: StudentModel | undefined;
  now: number;
}) {
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();

  const m = minutesUntil(lesson.startsAt, now);
  const relative = m <= 0 ? t('time.now') : `${t('time.in')} ${m} ${plural(m, minuteForms(t))}`;
  const strip = student ? catColors[student.category].accent : colors.accent;

  return (
    <Card
      leftStrip={strip}
      style={styles.nearest}
      onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}>
      <View style={styles.nearestTop}>
        <Text style={[styles.nearestLabel, { color: colors.muted }]}>{t('today.nearest')}</Text>
        <Text style={[styles.nearestRel, { color: colors.heading }]}>{relative}</Text>
      </View>
      <View style={styles.nearestMain}>
        {student ? <CatAvatar initials={student.initials} cat={student.category} size={46} /> : null}
        <View style={styles.nearestBody}>
          <Text style={[styles.nearestName, { color: colors.heading }]} numberOfLines={1}>
            {student?.name ?? t('common.none')}
          </Text>
          {lesson.topic ? (
            <Text style={[styles.nearestTopic, { color: colors.muted }]} numberOfLines={1}>
              {lesson.topic}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.nearestTime, { color: colors.heading }]}>{hhmm(lesson.startsAt)}</Text>
      </View>
      <View style={[styles.contactBtn, { backgroundColor: colors.primaryVlight }]}>
        <Icon name="phone" size={16} sw={1.8} stroke={colors.heading} />
        <Text style={[styles.contactLabel, { color: colors.heading }]}>{t('common.contact')}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 16,
  },
  ringWrap: { alignItems: 'center' },
  ringTop: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  ringSub: { fontSize: 12.5, fontWeight: '500', marginTop: 2 },

  nearest: {
    padding: 16,
    gap: 12,
  },
  nearestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nearestLabel: { fontSize: 12.5, fontWeight: '500' },
  nearestRel: { fontSize: 13.5, fontWeight: '600' },
  nearestMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nearestBody: { flex: 1, minWidth: 0, gap: 2 },
  nearestName: { fontSize: 16.5, fontWeight: '600', letterSpacing: -0.2 },
  nearestTopic: { fontSize: 13.5 },
  nearestTime: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
  },
  contactLabel: { fontSize: 14, fontWeight: '600' },

  list: { gap: 10 },
  rowShell: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  rowTime: { fontSize: 14.5, fontWeight: '600', fontVariant: ['tabular-nums'], width: 46 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  rowTopic: { fontSize: 13 },

  emptyNext: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyNextText: { fontSize: 14, fontWeight: '500' },

  tomorrow: { fontSize: 13.5, fontWeight: '500', textAlign: 'center', marginTop: 2 },
});
