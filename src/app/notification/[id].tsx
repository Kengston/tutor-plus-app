import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerSheet } from '@/components/DateTimePickerSheet';
import { EmptyState } from '@/components/EmptyState';
import {
  useAllLessons,
  useAllTransactions,
  useLesson,
  useLessonTransactions,
  useNotificationReads,
  useProfile,
  useStudent,
  useStudents,
  useTransaction,
} from '@/db/hooks';
import { cancelLesson, createTransaction, rescheduleLesson } from '@/db/mutations';
import { payStatusOf, unsettledDebts } from '@/domain/aggregates';
import { buildFeed } from '@/domain/notifications';
import type { NotificationKind } from '@/domain/types';
import { useNow } from '@/hooks/use-now';
import { plural, useT, type StringKey } from '@/i18n';
import { formatRub } from '@/lib/format';
import { useBack } from '@/lib/nav';
import { useSnack } from '@/lib/snack';
import { DEFAULT_REMINDER_PREFS, reminderPrefsOf } from '@/lib/profile';
import { hhmm } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, Chip, Icon, type IconName } from '@/ui';

/**
 * Notification detail (spec 09 §9.2) — the intermediate screen a feed row opens INSTEAD of
 * jumping straight to its target: the event's facts («Дата и время», «Формат», «Стоимость»/
 * «Сумма», «Статус оплаты») plus contextual actions. Lesson-ref items act on the live lesson
 * (open / reschedule / cancel / contact); transaction-ref items settle a debt (append-only
 * paid txn, ADR-0008) or open the operation. The item itself is DERIVED — we rebuild the feed
 * and look the id up (ADR-0013: no stored notifications table).
 */

/** RU «8 июня» day-month (genitive) — same helper idiom as finance/[id].tsx. */
function useDateLabel(): (ms: number) => string {
  const t = useT();
  return (ms: number) => {
    const d = new Date(ms);
    return `${d.getDate()} ${t(`monthGen.${d.getMonth()}` as StringKey)}`;
  };
}

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useBack();
  const t = useT();
  const { colors } = useTheme();
  const dateLabel = useDateLabel();

  // Rebuild the derived feed and find this item (ADR-0013 — items are never stored).
  const lessons = useAllLessons();
  const transactions = useAllTransactions();
  const students = useStudents();
  const profile = useProfile();
  const reads = useNotificationReads();
  const now = useNow();
  // Field-level deps — the model mutates in place, the instance alone would freeze the memo
  // (PROGRESS reactivity note / S7).
  const prefs = useMemo(
    () => (profile ? reminderPrefsOf(profile) : DEFAULT_REMINDER_PREFS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      profile,
      profile?.notifEnabled,
      profile?.notifDebts,
      profile?.notifLessons,
      profile?.notifPayment,
      profile?.notifSchedule,
      profile?.notifSummary,
      profile?.reminderLeadMin,
      profile?.pushGranted,
    ],
  );
  const item = useMemo(
    () => buildFeed({ lessons, transactions, students, prefs, reads, now }).find((it) => it.id === id),
    [lessons, transactions, students, prefs, reads, now, id],
  );

  // Resolve the ref target (the '' guard keeps the other hook inert — established repo idiom).
  const lessonId = item?.ref.kind === 'lesson' ? item.ref.id : '';
  const txnId = item?.ref.kind === 'transaction' ? item.ref.id : '';
  const lesson = useLesson(lessonId);
  const txn = useTransaction(txnId);
  const lessonTxns = useLessonTransactions(lessonId);
  const student = useStudent(lesson?.studentId ?? txn?.studentId ?? '');

  const [reschedOpen, setReschedOpen] = useState(false);
  // In-flight guard for «Отметить оплату»: `debtSettled` re-derives only after the txn
  // lands, so a double tap before navigation would append two settlements without it.
  const [settling, setSettling] = useState(false);
  const snack = useSnack();

  const TITLE: Record<NotificationKind, string> = {
    reminder: t('notif.reminder'),
    payment: t('notif.payment'),
    debt: t('notif.debt'),
    cancelled: t('notif.cancelled'),
    summary: t('notif.summary'),
  };

  /** Settle the debt txn: APPEND a paid row carrying its links (mirrors finance/[id].tsx). */
  const markPaid = async () => {
    if (!txn || settling) return;
    setSettling(true);
    await createTransaction({
      studentId: txn.studentId,
      type: 'paid',
      amount: txn.amount,
      method: 'transfer',
      lessonId: txn.lessonId,
      subjectId: txn.subjectId,
    });
    goBack();
  };

  const contact = () => {
    if (student?.phone) void Linking.openURL(`tel:${student.phone}`);
  };

  // Summary items (ref 'none') still show their instant; lesson/txn refs use their own.
  const eventAt = lesson ? lesson.startsAt : txn ? txn.occurredAt : item ? item.time : null;

  // A debt txn may have been settled AFTER the notification arose (money is append-only, the
  // row itself never changes) — derive the CURRENT status from the effective ledger, and gate
  // «Отметить оплату» on it so an already-settled debt can't be paid twice (review fix S14).
  const debtSettled =
    txn?.type === 'debt'
      ? txn.lessonId != null
        ? transactions.some((x) => x.type === 'paid' && x.lessonId === txn.lessonId)
        : !unsettledDebts(transactions).some((p) => p.studentId === txn.studentId && p.occurredAt === txn.occurredAt)
      : false;
  const payStatus = lesson ? payStatusOf(lesson.id, lessonTxns) : txn ? (txn.type === 'debt' && debtSettled ? 'paid' : txn.type) : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('notif.detailTitle')} onBack={() => goBack()} />

      {!item ? (
        <EmptyState icon="bell" text={t('common.none')} />
      ) : (
        <View style={styles.content}>
          {/* Hero: the event title + who. */}
          <View style={styles.hero}>
            <Text style={[styles.heroTitle, { color: colors.heading }]}>{TITLE[item.kind]}</Text>
            {item.studentName ? (
              <View style={styles.chipRow}>
                <Chip tone={item.kind === 'debt' ? 'danger' : 'neutral'}>{item.studentName}</Chip>
              </View>
            ) : null}
          </View>

          {/* Facts card (spec 09 §9.2). */}
          <Card style={styles.card}>
            {eventAt != null ? (
              <Field label={t('notif.dateTime')} value={`${dateLabel(eventAt)} · ${hhmm(eventAt)}`} />
            ) : null}
            {lesson ? (
              <>
                <Hairline />
                <Field label={t('field.format')} value={t(`format.${lesson.format}` as StringKey)} />
                <Hairline />
                <Field label={t('field.cost')} value={formatRub(lesson.price)} />
              </>
            ) : null}
            {txn ? (
              <>
                <Hairline />
                <Field label={t('finance.amount')} value={formatRub(txn.amount)} />
              </>
            ) : null}
            {item.kind === 'summary' && item.count != null ? (
              <>
                <Hairline />
                <Field
                  label={t('dyn.mLessons')}
                  value={`${item.count} ${plural(item.count, { one: t('unit.lessons.one'), few: t('unit.lessons.few'), many: t('unit.lessons.many') })}`}
                />
              </>
            ) : null}
            {payStatus ? (
              <>
                <Hairline />
                <Field label={t('lesson.payStatus')}>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: payStatus === 'paid' ? colors.paid : payStatus === 'debt' ? colors.danger : colors.stone700 },
                    ]}>
                    {t(`pay.${payStatus}` as StringKey)}
                  </Text>
                </Field>
              </>
            ) : null}
          </Card>

          {/* Contextual actions (spec 09 §9.2). */}
          <View style={styles.actions}>
            {lesson ? (
              <>
                <Action
                  icon="chevronRight"
                  label={t('notif.openLesson')}
                  primary
                  onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
                />
                {lesson.lifecycleStatus === 'upcoming' ? (
                  <>
                    <Action icon="calendar" label={t('action.reschedule')} onPress={() => setReschedOpen(true)} />
                    <Action
                      icon="close"
                      label={t('action.cancel')}
                      onPress={() => {
                        // Refused for a money-carrying lesson — the row here is upcoming,
                        // so money is the only possible blocker (mirrors the Today swipe).
                        void cancelLesson(lesson).then((done) => {
                          if (!done) {
                            snack.show(t('snack.protectedByMoney'));
                            return;
                          }
                          goBack();
                        });
                      }}
                    />
                  </>
                ) : null}
              </>
            ) : null}
            {txn ? (
              txn.type === 'debt' && !debtSettled ? (
                <Action icon="check" label={t('lesson.recordPayment')} primary onPress={() => void markPaid()} />
              ) : (
                // Paid — or a debt already settled since the notification (no double payment).
                <Action
                  icon="wallet"
                  label={t('notif.openOperation')}
                  primary
                  onPress={() => router.push({ pathname: '/finance/[id]', params: { id: txn.id } })}
                />
              )
            ) : null}
            {student?.phone ? <Action icon="phone" label={t('common.contact')} onPress={contact} /> : null}
          </View>
        </View>
      )}

      {/* Reschedule — shared picker; the mutation detaches a series occurrence (ADR-0016). */}
      {lesson ? (
        <DateTimePickerSheet
          visible={reschedOpen}
          withTime
          initial={lesson.startsAt}
          title={t('action.reschedule')}
          onClose={() => setReschedOpen(false)}
          onPick={(ms) => {
            void rescheduleLesson(lesson, ms).then((moved) => {
              if (!moved) {
                snack.show(t('snack.protectedByMoney'));
                return;
              }
              goBack();
            });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** One tappable action row — primary gets the tinted fill, the rest stay quiet. */
function Action({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: primary ? colors.primary : colors.stoneLight, borderRadius: radius.field },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={18} sw={1.9} stroke={primary ? colors.onTint : colors.body} />
      <Text style={[styles.actionLabel, { color: primary ? colors.onTint : colors.body }]}>{label}</Text>
    </Pressable>
  );
}

/** Compact stack header — mirrors finance/[id].tsx (this stack has headerShown:false). */
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={title}>
        <Icon name="back" size={20} stroke={colors.heading} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.heading }]}>{title}</Text>
    </View>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      {children ?? <Text numberOfLines={1} style={[styles.fieldValue, { color: colors.heading }]}>{value}</Text>}
    </View>
  );
}

function Hairline() {
  const { colors } = useTheme();
  return <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 10 },
  heroTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  chipRow: { flexDirection: 'row', justifyContent: 'center' },
  card: { paddingHorizontal: 16, paddingVertical: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 13,
  },
  fieldLabel: { fontSize: 14, fontWeight: '500' },
  fieldValue: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  hairline: { height: StyleSheet.hairlineWidth },
  actions: { gap: 10 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  actionLabel: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
