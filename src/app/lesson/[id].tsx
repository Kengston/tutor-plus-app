import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerSheet } from '@/components/DateTimePickerSheet';
import { EmptyState } from '@/components/EmptyState';
import { ScopeSheetBody } from '@/components/ScopeSheet';
import { useLesson, useLessonTransactions, useStudent } from '@/db/hooks';
import {
  markLessonConducted,
  recordLessonPayment,
  rescheduleLesson,
  restoreLessonLifecycle,
  reverseTransaction,
} from '@/db/mutations';
import { isSeriesLesson, scopeCancel, scopeReschedule } from '@/db/scope';
import { payStatusOf } from '@/domain/aggregates';
import { canJoinOnline, meetHost } from '@/domain/lesson-link';
import type { Scope } from '@/domain/scope';
import { type PayStatus, type TxnType } from '@/domain/types';
import { lifecycleSnapshot } from '@/domain/undo';
import { useT } from '@/i18n';
import { formatRub } from '@/lib/format';
import { useBack } from '@/lib/nav';
import { useSnack } from '@/lib/snack';
import { hhmm } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, Dot, Icon, Sheet, Text, TextInput, type DotTone } from '@/ui';

/** RU date «8 июня» (genitive day-month) from a UTC-instant ms (device-local), via i18n month keys. */
function useDateLabel(): (ms: number) => string {
  const t = useT();
  return (ms: number) => {
    const d = new Date(ms);
    const month = t(`monthGen.${d.getMonth()}` as 'monthGen.0');
    return `${d.getDate()} ${month}`;
  };
}

const PAY_TONE: Record<PayStatus, DotTone> = { paid: 'green', debt: 'red', expected: 'amber' };

export default function LessonCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();
  const dateLabel = useDateLabel();

  const lesson = useLesson(id);
  const student = useStudent(lesson?.studentId ?? '');
  const txns = useLessonTransactions(id);
  const pay = payStatusOf(id, txns);

  const [rescheduling, setRescheduling] = useState(false);
  const [payingOpen, setPayingOpen] = useState(false);
  // Scope flow state: cancel → (series? scope) → reason; reschedule → date → (series? scope).
  const [cancelScopeOpen, setCancelScopeOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pendingCancelScope, setPendingCancelScope] = useState<Scope>('one');
  const [pendingStartsAt, setPendingStartsAt] = useState<number | null>(null);
  const [rescheduleScopeOpen, setRescheduleScopeOpen] = useState(false);
  const snack = useSnack();

  const series = lesson ? isSeriesLesson(lesson) : false;
  const conducted = lesson?.lifecycleStatus === 'done';
  const cancelled = lesson?.lifecycleStatus === 'cancelled';

  // «Готово» + undo: snapshot BEFORE the mutation, «Вернуть» restores it.
  const conductWithUndo = () => {
    if (!lesson) return;
    const snap = lifecycleSnapshot(lesson);
    void markLessonConducted(lesson).then(() => {
      snack.show(t('snack.lessonDone'), {
        actionLabel: t('action.undo'),
        onAction: () => void restoreLessonLifecycle(lesson, snap),
      });
    });
  };

  // Cancel: a series lesson first asks the scope, then the reason; a standalone lesson
  // goes straight to the reason. `scopeCancel` handles «one» as a single-lesson cancel.
  const onCancelPress = () => {
    if (!lesson) return;
    setReason('');
    if (series) setCancelScopeOpen(true);
    else {
      setPendingCancelScope('one');
      setReasonOpen(true);
    }
  };
  const onCancelScopePick = (scope: Scope) => {
    setPendingCancelScope(scope);
    setCancelScopeOpen(false);
    setReasonOpen(true);
  };
  /**
   * A scope edit can touch NOTHING: `domain/scope` protects an occurrence that carries a
   * money operation or is already done/cancelled, and «all» can land on an empty window
   * (ADR-0016 §4). Reporting success there is a lie (the lesson stays put), and reporting
   * the wrong reason is only marginally better — so name the one that actually applies.
   * `txns` is the same reversal-filtered ledger the protection is computed from.
   */
  const refusalText = () => {
    if (txns.length > 0) return t('snack.protectedByMoney');
    if (lesson?.lifecycleStatus === 'done') return t('snack.protectedDone');
    return t('snack.noChanges');
  };

  const confirmCancel = () => {
    if (!lesson) return;
    setReasonOpen(false);
    void scopeCancel(lesson, pendingCancelScope, reason.trim()).then(({ affected, undo }) => {
      if (affected === 0) {
        snack.show(refusalText());
        return;
      }
      snack.show(t('snack.lessonCancelled'), { actionLabel: t('action.undo'), onAction: () => void undo() });
      // Return to the schedule after the action (prototype pattern) — the cancelled lesson
      // leaves the timeline, and the detail is a transient action screen.
      goBack();
    });
  };

  // Reschedule: pick the new time, then a series lesson asks the scope; a standalone one
  // moves directly.
  const onReschedulePicked = (ms: number) => {
    if (!lesson) return;
    if (series) {
      setPendingStartsAt(ms);
      setRescheduleScopeOpen(true);
    } else {
      // The mutation refuses for done/cancelled/money-carrying lessons — report the
      // refusal instead of silently navigating away as if the move happened.
      void rescheduleLesson(lesson, ms).then((moved) => {
        if (!moved) {
          snack.show(refusalText());
          return;
        }
        goBack();
      });
    }
  };
  const onRescheduleScopePick = (scope: Scope) => {
    setRescheduleScopeOpen(false);
    if (!lesson || pendingStartsAt === null) return;
    void scopeReschedule(lesson, scope, pendingStartsAt).then(({ affected, undo, reason }) => {
      if (affected === 0) {
        // A day-change refusal is not a protection: name the supported path instead.
        snack.show(reason === 'weekday' ? t('snack.seriesDayViaEditor') : refusalText());
        return;
      }
      snack.show(t('snack.rescheduled'), { actionLabel: t('action.undo'), onAction: () => void undo() });
      // Return to the schedule, which reflects the new time (prototype pattern).
      goBack();
    });
  };
  // Money undo (ADR-0002): «Отменить» appends the COMPENSATING row — never deletes.
  const recordPaymentWithUndo = (type: Exclude<TxnType, 'expected'>) => {
    if (!lesson) return;
    void recordLessonPayment(lesson, { type }).then((txn) => {
      // null → the effective ledger already carries this state (double tap / stale sheet):
      // nothing was written, so no success snack and nothing to undo.
      if (!txn) {
        snack.show(t('snack.noChanges'));
        return;
      }
      snack.show(t('snack.paymentRecorded'), {
        actionLabel: t('action.cancel'),
        onAction: () => {
          void reverseTransaction(txn).then(() => snack.show(t('snack.undone')));
        },
      });
    });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('lesson.nom')} onBack={() => goBack()} />

      {!lesson ? (
        <EmptyState mark="wave" text={t('common.notFound')} />
      ) : (
        <View style={styles.content}>
          <Card style={styles.card}>
            <Field label={t('field.student')} value={student?.name ?? t('common.none')} />
            <Hairline />
            <Field label={t('field.topic')} value={lesson.topic || t('common.none')} />
            <Hairline />
            <Field label={t('field.date')} value={`${dateLabel(lesson.startsAt)} · ${hhmm(lesson.startsAt)}`} />
            <Hairline />
            <Field label={t('field.duration')} value={`${lesson.durationMin} ${t('common.min')}`} />
            <Hairline />
            <Field label={t('field.format')} value={t(`format.${lesson.format}` as 'format.online')} />
            {lesson.link ? (
              <>
                <Hairline />
                {/* Link rendered as its short host (delta §3.1) — tap opens the meeting. */}
                <Field label={t('field.link')}>
                  <Pressable
                    onPress={() => Linking.openURL(lesson.link as string).catch(() => snack.show(t('link.openFailed')))}
                    hitSlop={6}
                    accessibilityRole="link"
                    accessibilityLabel={t('lesson.openMeeting')}
                    style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
                    <Icon name="link" size={16} sw={1.7} stroke={colors.stoneInactive} />
                    <Text style={[styles.linkHost, { color: colors.primaryDeep }]} numberOfLines={1}>
                      {meetHost(lesson.link) ?? t('link.fallback')}
                    </Text>
                  </Pressable>
                </Field>
              </>
            ) : null}
            <Hairline />
            <Field label={t('field.cost')} value={formatRub(lesson.price)} />
            <Hairline />
            <Field label={t('field.status')}>
              <View style={styles.statusRow}>
                <Text style={[styles.value, { color: colors.heading }]}>
                  {t(`life.${lesson.lifecycleStatus}` as 'life.done')}
                </Text>
                <View style={[styles.payPill, { backgroundColor: colors.stoneLight }]}>
                  <Dot tone={PAY_TONE[pay]} />
                  <Text style={[styles.payText, { color: colors.body }]}>{t(`pay.${pay}` as 'pay.paid')}</Text>
                </View>
              </View>
            </Field>
            {/* Cancel reason (S7) — shown once a cancelled lesson carries one. */}
            {lesson.lifecycleStatus === 'cancelled' && lesson.cancelReason ? (
              <>
                <Hairline />
                <Field label={t('cancel.reasonTitle')} value={lesson.cancelReason} />
              </>
            ) : null}
          </Card>

          <View style={styles.actions}>
            {/* «Открыть встречу» — primary, only for online lessons with a link (spec/delta §3.1). */}
            {canJoinOnline(lesson) ? (
              <Pressable
                onPress={() => Linking.openURL(lesson.link as string).catch(() => snack.show(t('link.openFailed')))}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: colors.primary, borderRadius: radius.field },
                  pressed && styles.pressed,
                ]}>
                <Icon name="video" size={18} sw={1.8} stroke={colors.onTint} />
                <Text style={[styles.actionLabel, { color: colors.onTint }]}>{t('lesson.openMeeting')}</Text>
              </Pressable>
            ) : null}
            {conducted ? null : (
              <Pressable
                onPress={conductWithUndo}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: colors.primary, borderRadius: radius.field },
                  pressed && styles.pressed,
                ]}>
                <Icon name="check" size={18} sw={2} stroke={colors.onTint} />
                <Text style={[styles.actionLabel, { color: colors.onTint }]}>{t('lesson.markDone')}</Text>
              </Pressable>
            )}

            {/* Paid → no further money action exists; opening a sheet of two disabled
                choices is a dead end, so the entry point itself goes quiet. */}
            <Pressable
              onPress={() => setPayingOpen(true)}
              disabled={pay === 'paid'}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                pay === 'paid' && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Icon name="wallet" size={18} sw={1.8} stroke={colors.body} />
              <Text style={[styles.actionLabel, { color: colors.body }]}>{t('lesson.recordPayment')}</Text>
              <View style={[styles.payPill, { backgroundColor: colors.surface }]}>
                <Dot tone={PAY_TONE[pay]} />
                <Text style={[styles.payText, { color: colors.body }]}>{t(`pay.${pay}` as 'pay.paid')}</Text>
              </View>
            </Pressable>

            <View style={styles.actionPair}>
              <Pressable
                onPress={() => setRescheduling(true)}
                style={({ pressed }) => [
                  styles.action,
                  styles.actionGhost,
                  { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                  pressed && styles.pressed,
                ]}>
                <Icon name="refresh" size={17} sw={1.8} stroke={colors.body} />
                <Text style={[styles.actionLabel, { color: colors.body }]}>{t('action.reschedule')}</Text>
              </Pressable>

              {/* Already cancelled → nothing left to cancel; the domain would refuse anyway. */}
              <Pressable
                onPress={onCancelPress}
                disabled={cancelled}
                style={({ pressed }) => [
                  styles.action,
                  styles.actionGhost,
                  { backgroundColor: colors.dangerLight, borderRadius: radius.field },
                  cancelled && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <Icon name="close" size={17} sw={2} stroke={colors.danger} />
                <Text style={[styles.actionLabel, { color: colors.danger }]}>{t('action.cancel')}</Text>
              </Pressable>
            </View>
          </View>

          <DateTimePickerSheet
            visible={rescheduling}
            initial={lesson.startsAt}
            title={t('action.reschedule')}
            onClose={() => setRescheduling(false)}
            onPick={onReschedulePicked}
          />

          {/* Series scope sheets (ADR-0016 §3): cancel or reschedule this / following / all. */}
          {cancelScopeOpen ? (
            <Sheet title={t('scope.cancelTitle')} onClose={() => setCancelScopeOpen(false)}>
              <ScopeSheetBody mode="cancel" onPick={onCancelScopePick} />
            </Sheet>
          ) : null}
          {rescheduleScopeOpen ? (
            <Sheet title={t('scope.editTitle')} onClose={() => setRescheduleScopeOpen(false)}>
              <ScopeSheetBody mode="edit" onPick={onRescheduleScopePick} />
            </Sheet>
          ) : null}

          {/* Cancel-reason prompt (the reason is stored and shown in the details). */}
          {reasonOpen ? (
            <Sheet title={t('cancel.reasonTitle')} onClose={() => setReasonOpen(false)}>
              <View style={styles.reasonSheet}>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder={t('cancel.reasonPlaceholder')}
                  placeholderTextColor={colors.muted}
                  style={[styles.reasonInput, { borderRadius: radius.control, color: colors.heading, backgroundColor: colors.stoneLight, borderColor: colors.hairline }]}
                />
                <Pressable
                  onPress={confirmCancel}
                  style={({ pressed }) => [styles.reasonConfirm, { backgroundColor: colors.danger, borderRadius: radius.field }, pressed && styles.pressed]}>
                  <Text style={[styles.reasonConfirmLabel, { color: colors.onTint }]}>{t('cancel.confirm')}</Text>
                </Pressable>
              </View>
            </Sheet>
          ) : null}

          {payingOpen ? (
            <Sheet title={t('lesson.recordPayment')} onClose={() => setPayingOpen(false)}>
              {/* Choices mirror the mutation's idempotency rule (belt + suspenders): a paid
                  lesson takes no further money action; an open debt only takes «Оплачено»
                  (settlement). The mutation still refuses if a stale sheet slips through. */}
              <View style={styles.paySheet}>
                <Pressable
                  disabled={pay === 'paid'}
                  onPress={() => {
                    recordPaymentWithUndo('paid');
                    setPayingOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.payChoice,
                    { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                    pay === 'paid' && styles.disabled,
                    pressed && styles.pressed,
                  ]}>
                  <Dot tone="green" />
                  <Text style={[styles.payChoiceLabel, { color: colors.heading }]}>{t('pay.paid')}</Text>
                </Pressable>
                <Pressable
                  disabled={pay !== 'expected'}
                  onPress={() => {
                    recordPaymentWithUndo('debt');
                    setPayingOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.payChoice,
                    { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                    pay !== 'expected' && styles.disabled,
                    pressed && styles.pressed,
                  ]}>
                  <Dot tone="red" />
                  <Text style={[styles.payChoiceLabel, { color: colors.heading }]}>{t('pay.debt')}</Text>
                </Pressable>
              </View>
            </Sheet>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

/** Compact stack header (this stack has headerShown:false) — mirrors Screen.tsx shell. */
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

function Field({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      {children ?? <Text style={[styles.value, { color: colors.heading }]}>{value}</Text>}
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
  card: { paddingHorizontal: 16, paddingVertical: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 13,
  },
  label: { fontSize: 14, fontWeight: '500' },
  value: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  hairline: { height: StyleSheet.hairlineWidth },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, justifyContent: 'flex-end' },
  payPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  payText: { fontSize: 12.5, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, justifyContent: 'flex-end' },
  linkHost: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  actions: { gap: 10 },
  actionPair: { flexDirection: 'row', gap: 10 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  actionGhost: { flex: 1 },
  actionLabel: { fontSize: 15, fontWeight: '600' },
  reasonSheet: { gap: 12 },
  reasonInput: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  reasonConfirm: { paddingVertical: 15, alignItems: 'center' },
  reasonConfirmLabel: { fontSize: 15.5, fontWeight: '600' },
  paySheet: { gap: 10 },
  payChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  payChoiceLabel: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
