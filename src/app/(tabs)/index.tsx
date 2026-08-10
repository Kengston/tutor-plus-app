import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { DateTimePickerSheet } from '@/components/DateTimePickerSheet';
import { EmptyState } from '@/components/EmptyState';
import { QuickActionsSheet } from '@/components/QuickActionsSheet';
import { Screen } from '@/components/Screen';
import { daySummary, debtors } from '@/domain/aggregates';
import { canJoinOnline } from '@/domain/lesson-link';
import { lifecycleSnapshot } from '@/domain/undo';
import type { LessonModel, StudentModel } from '@/db/models';
import { useAllTransactions, useLessonsInRange, useProfile, useStudents } from '@/db/hooks';
import { cancelLesson, markLessonConducted, rescheduleLesson, restoreLessonLifecycle } from '@/db/mutations';
import { plural, useT, type StringKey } from '@/i18n';
import { parseHomeBlocks } from '@/lib/home-blocks';
import { useSnack } from '@/lib/snack';
import { dayBounds, dayBoundsOffset, hhmm, minutesUntil, nowMs } from '@/lib/time';
import { catColors, useTheme } from '@/theme';
import { Card, CatAvatar, Chip, Fab, Icon, SectionLabel, SwipeRow, Text } from '@/ui';

/** Minutes phrasing forms for `plural()` — composed once per render via t(). */
function minuteForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.minutes.one'), few: t('unit.minutes.few'), many: t('unit.minutes.many') };
}

/** Lessons phrasing forms (mode-aware). */
function lessonForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.lessons.one'), few: t('unit.lessons.few'), many: t('unit.lessons.many') };
}

/** Hours phrasing forms for `plural()`. */
function hourForms(t: ReturnType<typeof useT>) {
  return { one: t('unit.hours.one'), few: t('unit.hours.few'), many: t('unit.hours.many') };
}

export default function TodayScreen() {
  const t = useT();
  const { colors, radius } = useTheme();
  const router = useRouter();

  const { start, end } = dayBounds();
  const lessons = useLessonsInRange(start, end);
  const txns = useAllTransactions();
  const students = useStudents();

  const now = nowMs();
  const snack = useSnack();

  // Reschedule target — the lesson whose date/time the picker sheet is editing.
  const [reschedulingLesson, setReschedulingLesson] = useState<LessonModel | null>(null);
  // FAB opens the quick-actions sheet (spec 04-today) instead of the lesson form directly.
  const [quickOpen, setQuickOpen] = useState(false);

  // «Готово»/«Отменить» + undo snack: capture the lifecycle snapshot BEFORE the
  // mutation; «Вернуть» restores it (reverse mutation, domain/undo).
  const conductWithUndo = (l: LessonModel) => {
    const snap = lifecycleSnapshot(l);
    void markLessonConducted(l).then(() => {
      snack.show(t('snack.lessonDone'), {
        actionLabel: t('action.undo'),
        onAction: () => void restoreLessonLifecycle(l, snap),
      });
    });
  };
  const cancelWithUndo = (l: LessonModel) => {
    const snap = lifecycleSnapshot(l);
    void cancelLesson(l).then((done) => {
      // Refused: the lesson carries money (rows here are upcoming, so done/cancelled is
      // out) — cancelling it would desync the Finance list from the debt aggregates.
      if (!done) {
        snack.show(t('snack.protectedByMoney'));
        return;
      }
      snack.show(t('snack.lessonCancelled'), {
        actionLabel: t('action.undo'),
        onAction: () => void restoreLessonLifecycle(l, snap),
      });
    });
  };

  const studentsById = useMemo(() => {
    const m = new Map<string, StudentModel>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  // Cancelled lessons are invisible on «Сегодня» — one set feeds the «Ваш день»
  // numbers, the dot-timeline and the rows, so they can never disagree (S4 pattern).
  const visibleToday = useMemo(
    () => lessons.filter((l) => l.lifecycleStatus !== 'cancelled'),
    [lessons],
  );

  // Today's still-active lessons from now on (sorted ascending by the hook).
  const upcomingToday = visibleToday.filter(
    (l) =>
      l.startsAt >= now && (l.lifecycleStatus === 'upcoming' || l.lifecycleStatus === 'ongoing'),
  );
  const nearest = upcomingToday[0];

  // Debt badge in «Далее сегодня» (spec 04: «Есть долг») — per-STUDENT outstanding
  // debt over the effective ledger, via the existing debtors aggregate.
  const debtByStudent = useMemo(
    () => new Map(debtors(txns).map((d) => [d.studentId, d.amount])),
    [txns],
  );

  const tb = dayBoundsOffset(1);
  const tomorrow = useLessonsInRange(tb.start, tb.end);
  const tomorrowVisible = useMemo(
    () => tomorrow.filter((l) => l.lifecycleStatus !== 'cancelled'),
    [tomorrow],
  );
  // Time range for the tomorrow card: «HH:MM — HH:MM», or a single time when there is
  // only one lesson (a degenerate «11:00 — 11:00» reads as a bug). Lessons are ASC-sorted.
  const tomorrowRange =
    tomorrowVisible.length === 0
      ? ''
      : tomorrowVisible.length === 1
        ? hhmm(tomorrowVisible[0].startsAt)
        : `${hhmm(tomorrowVisible[0].startsAt)} — ${hhmm(tomorrowVisible[tomorrowVisible.length - 1].startsAt)}`;

  // Greeting header (spec 04): «Добрый день, {Имя}» + «вторник, 26 мая».
  const profile = useProfile();
  // «Настройка главной» (spec 10 §10.1): which OPTIONAL blocks are visible (v10 CSV; null = all).
  const homeBlocks = parseHomeBlocks(profile?.homeBlocks ?? null);
  const showNearest = homeBlocks.includes('nearest');
  const showTomorrow = homeBlocks.includes('tomorrow');
  // The nearest lesson is highlighted in its own hero card — drop it from the list below ONLY
  // while that card is visible; with the block hidden the lesson falls back into «Далее сегодня»
  // (review fix S16 — otherwise the very next lesson vanished from the screen).
  const restToday = showNearest && nearest ? upcomingToday.slice(1) : upcomingToday;
  const firstName = profile?.name?.trim().split(/\s+/)[0] ?? '';
  const greeting = firstName ? `${t('today.greeting')}, ${firstName}` : t('today.greeting');
  const nowDate = new Date(now);
  const dateLine = `${t(`wdFull.${nowDate.getDay()}` as StringKey)}, ${nowDate.getDate()} ${t(`monthGen.${nowDate.getMonth()}` as StringKey)}`;

  // «Все» / tomorrow card → Расписание · Список on the respective day (spec 04).
  const openScheduleList = (dayStart: number) =>
    router.push({ pathname: '/schedule', params: { view: 'list', day: String(dayStart) } });

  return (
    <Screen
      title={greeting}
      subtitle={dateLine}
      bell
      floatingAction={<Fab onPress={() => setQuickOpen(true)} />}>
      {visibleToday.length === 0 ? (
        // Empty day (spec 04 AC): no placeholder cards — a single empty state.
        <EmptyState
          mark="circle_date"
          date={new Date(start).getDate()}
          text={t('today.empty')}
          action={t('lesson.create')}
          onAction={() => router.push('/lesson/new')}
        />
      ) : (
        <>
          {/* «Ваш день» (spec 04, prototype TodayScreen): counts + dot-timeline. */}
          <YourDayCard
            lessons={visibleToday}
            studentsById={studentsById}
            onPress={() => openScheduleList(start)}
          />

          {/* Nearest lesson — optional block («Настройка главной»). */}
          {showNearest && nearest ? (
            <NearestCard lesson={nearest} student={studentsById.get(nearest.studentId)} now={now} />
          ) : null}

      {/* Далее сегодня */}
      <View>
        <SectionLabel
          right={
            <Pressable onPress={() => openScheduleList(start)} hitSlop={8} accessibilityRole="button">
              {({ pressed }) => (
                <Text style={[styles.allLink, { color: colors.primaryDeep, opacity: pressed ? 0.7 : 1 }]}>
                  {t('common.all')}
                </Text>
              )}
            </Pressable>
          }>
          {t('today.next')}
        </SectionLabel>
        {restToday.length === 0 ? (
          <View style={[styles.emptyNext, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.row }]}>
            <Text style={[styles.emptyNextText, { color: colors.muted }]}>{t('today.nothingNext')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {restToday.map((l) => (
              <View key={l.id} style={[styles.rowShell, { borderColor: colors.hairline, borderRadius: radius.row }]}>
                <SwipeRow
                  leftActions={[
                    {
                      label: t('action.conduct'),
                      color: colors.paid,
                      icon: 'check',
                      onPress: () => conductWithUndo(l),
                    },
                  ]}
                  rightActions={[
                    {
                      label: t('action.reschedule'),
                      // Канон §8: «Перенести» — слейт, НЕ янтарь. Раньше здесь стоял
                      // `warning`, а в вечерней теме он равен бренд-акценту #FFD364 —
                      // жёлтый оказывался цветом действия, что прямо запрещено §4.
                      color: colors.catSlate,
                      icon: 'refresh',
                      onPress: () => {
                        setReschedulingLesson(l);
                      },
                    },
                    {
                      label: t('action.cancel'),
                      color: colors.danger,
                      icon: 'close',
                      onPress: () => cancelWithUndo(l),
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
                    {/* Trailing slot is badge-or-nothing (v2 prototype TLRow): the
                        «Есть долг» badge for students who owe money, no pay dot. */}
                    {(debtByStudent.get(l.studentId) ?? 0) > 0 ? (
                      <Chip tone="danger">{t('today.debtBadge')}</Chip>
                    ) : null}
                  </Pressable>
                </SwipeRow>
              </View>
            ))}
          </View>
        )}
      </View>
        </>
      )}

      {/* Tomorrow card (spec 04): «ЗАВТРА, DD МММ» + count · time range → schedule.
          Optional block («Настройка главной»). */}
      {showTomorrow ? (
        <Card onPress={() => openScheduleList(tb.start)} style={styles.tomorrowCard}>
          <View style={styles.tomorrowBody}>
            <Text style={[styles.tomorrowLabel, { color: colors.muted }]}>
              {t('common.tomorrow')}, {new Date(tb.start).getDate()}{' '}
              {t(`monthGen.${new Date(tb.start).getMonth()}` as StringKey)}
            </Text>
            <Text style={[styles.tomorrowCount, { color: colors.heading }]}>
              {tomorrowVisible.length} {plural(tomorrowVisible.length, lessonForms(t))}
              {tomorrowVisible.length > 0 ? ` · ${tomorrowRange}` : ''}
            </Text>
          </View>
          <View style={[styles.tomorrowChevron, { backgroundColor: colors.stoneLight }]}>
            <Icon name="chevronRight" size={18} stroke={colors.stone700} />
          </View>
        </Card>
      ) : null}

      <DateTimePickerSheet
        visible={reschedulingLesson !== null}
        initial={reschedulingLesson?.startsAt}
        title={t('action.reschedule')}
        onClose={() => setReschedulingLesson(null)}
        onPick={(ms) => {
          if (reschedulingLesson)
            void rescheduleLesson(reschedulingLesson, ms).then((moved) => {
              if (!moved) snack.show(t('snack.protectedByMoney'));
            });
        }}
      />

      {quickOpen ? <QuickActionsSheet onClose={() => setQuickOpen(false)} /> : null}
    </Screen>
  );
}

/**
 * «Ваш день» (spec 04; prototype TodayScreen card): header «Ваш день» + «N/М»,
 * line «K проведено · L впереди», an even-spaced dot-timeline (done = filled with
 * the student colour, next = highlighted with a primary-light halo, later = outline)
 * with a progress line, and the «следующее в HH:MM» caption under the next dot.
 * `lessons` are the day's visible (non-cancelled) lessons, sorted ascending.
 */
function YourDayCard({
  lessons,
  studentsById,
  onPress,
}: {
  lessons: LessonModel[];
  studentsById: Map<string, StudentModel>;
  onPress: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();

  const s = daySummary(lessons);
  const ahead = s.total - s.done;
  // Prototype semantics: the "next" dot is the first non-done lesson in day order.
  const nextIdx = lessons.findIndex((l) => l.lifecycleStatus !== 'done');
  const n = lessons.length;
  const prog = n > 1 ? Math.min(nextIdx < 0 ? n : nextIdx, n - 1) / (n - 1) : 0;

  return (
    <Card onPress={onPress} style={styles.yourDay}>
      <View style={styles.ydHead}>
        <Text style={[styles.ydTitle, { color: colors.heading }]}>{t('today.yourDay')}</Text>
        <Text style={[styles.ydCount, { color: colors.heading }]}>
          {s.done}/{s.total}
        </Text>
      </View>
      <Text style={[styles.ydSub, { color: colors.muted }]}>
        {s.done} {t('today.conducted')} · {ahead} {t('today.ahead')}
      </Text>

      {/* Dot-timeline: progress line + one evenly-spaced dot per lesson. */}
      <View style={styles.tlWrap}>
        <View style={[styles.tlLine, { backgroundColor: colors.hairline }]} />
        <View style={[styles.tlLine, { backgroundColor: colors.primary, width: `${prog * 100}%` }]} />
        <View style={styles.tlDots}>
          {lessons.map((l, i) => {
            const cat = studentsById.get(l.studentId)?.category;
            const accent = cat ? catColors[cat].accent : colors.accent;
            const isDone = l.lifecycleStatus === 'done';
            const isNext = i === nextIdx;
            return (
              <View key={l.id} style={styles.tlSlot}>
                {isDone ? (
                  <View style={[styles.tlDot, { backgroundColor: accent }]} />
                ) : isNext ? (
                  <View style={[styles.tlHalo, { backgroundColor: colors.primaryLight }]}>
                    <View style={[styles.tlDot, { backgroundColor: accent }]} />
                  </View>
                ) : (
                  <View style={[styles.tlDotFuture, { backgroundColor: colors.surface, borderColor: colors.stoneInactive }]} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* «следующее в HH:MM» — centred under the next dot via the same slot row. */}
      {nextIdx >= 0 && s.nextAt !== null ? (
        <View style={styles.tlCaptionRow}>
          {lessons.map((l, i) => (
            <View key={l.id} style={styles.tlSlot}>
              {i === nextIdx ? (
                // No numberOfLines: on web it ellipsizes to the 20px slot width («с...»);
                // the fixed-width caption is MEANT to overhang the slot, centred on the dot.
                // At the ENDS of the lane it may only overhang INWARDS: the first and last
                // dots sit flush with the card, so a centred caption hung 50px past the edge
                // and got cut off by the screen — which is every morning, before the first
                // lesson of the day, when the next dot IS the first one.
                <Text
                  style={[
                    styles.tlCaption,
                    { color: colors.muted },
                    i === lessons.length - 1 && i !== 0 ? styles.tlCaptionEnd : null,
                    i === 0 ? styles.tlCaptionStart : null,
                  ]}>
                  {t('today.nextAt')} {hhmm(s.nextAt as number)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Card>
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
  const { colors, radius } = useTheme();
  const router = useRouter();
  const snack = useSnack();

  const m = minutesUntil(lesson.startsAt, now);
  const relative =
    m <= 0
      ? t('time.now')
      : m < 60
        ? `${t('time.in')} ${m} ${plural(m, minuteForms(t))}`
        : `${t('time.in')} ${Math.round(m / 60)} ${plural(Math.round(m / 60), hourForms(t))}`;
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
      {/* «Подключиться» — primary, ONLY for online lessons with a link (spec 04-today,
          delta §3.1); «Связаться» stays alongside (or full-width when no join button). */}
      <View style={styles.ctaRow}>
        {canJoinOnline(lesson) ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL(lesson.link as string).catch(() => snack.show(t('link.openFailed')));
            }}
            accessibilityRole="button"
            accessibilityLabel={t('lesson.join')}
            style={({ pressed }) => [styles.contactBtn, styles.ctaFlex, { backgroundColor: colors.primary, borderRadius: radius.control, opacity: pressed ? 0.85 : 1 }]}>
            <Icon name="video" size={16} sw={1.8} stroke={colors.onTint} />
            <Text style={[styles.contactLabel, { color: colors.onTint }]}>{t('lesson.join')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            const phone = student?.phone?.replace(/[^\d+]/g, '');
            if (phone) Linking.openURL(`tel:${phone}`).catch(() => undefined);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.contact')}
          style={({ pressed }) => [styles.contactBtn, styles.ctaFlex, { backgroundColor: colors.primaryVlight, borderRadius: radius.control, opacity: pressed ? 0.85 : 1 }]}>
          <Icon name="phone" size={16} sw={1.8} stroke={colors.heading} />
          <Text style={[styles.contactLabel, { color: colors.heading }]}>{t('common.contact')}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // «Ваш день» card + dot-timeline (prototype TodayScreen)
  yourDay: { padding: 16 },
  ydHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  ydTitle: { fontSize: 15, fontWeight: '700' },
  ydCount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ydSub: { fontSize: 13.5, marginTop: 3 },
  tlWrap: { marginTop: 16, height: 20, justifyContent: 'center' },
  tlLine: { position: 'absolute', left: 8, right: 8, height: 2, borderRadius: 2 },
  tlDots: { flexDirection: 'row', justifyContent: 'space-between' },
  tlSlot: { width: 20, alignItems: 'center', justifyContent: 'center' },
  tlDot: { width: 12, height: 12, borderRadius: 6 },
  tlHalo: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tlDotFuture: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  tlCaptionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, height: 15 },
  tlCaption: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'], width: 120, textAlign: 'center' },
  // Half the overhang ((120 − 20) / 2) pushed back inwards, so an end caption starts/ends
  // flush with its dot instead of hanging outside the card.
  tlCaptionStart: { textAlign: 'left', transform: [{ translateX: 50 }] },
  tlCaptionEnd: { textAlign: 'right', transform: [{ translateX: -50 }] },
  allLink: { fontSize: 14, fontWeight: '600' },

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
  },
  contactLabel: { fontSize: 14, fontWeight: '600' },
  ctaRow: { flexDirection: 'row', gap: 10 },
  ctaFlex: { flex: 1 },

  list: { gap: 10 },
  rowShell: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  rowTime: { fontSize: 14.5, fontWeight: '600', fontVariant: ['tabular-nums'], width: 46 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  rowTopic: { fontSize: 13 },

  emptyNext: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyNextText: { fontSize: 14, fontWeight: '500' },

  // Tomorrow card (spec 04: «ЗАВТРА, DD МММ» + count · range + chevron)
  tomorrowCard: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tomorrowBody: { flex: 1, minWidth: 0 },
  tomorrowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  tomorrowCount: { fontSize: 16, fontWeight: '500', marginTop: 5, fontVariant: ['tabular-nums'] },
  tomorrowChevron: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
