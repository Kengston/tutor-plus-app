import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerSheet } from '@/components/DateTimePickerSheet';
import { EmptyState } from '@/components/EmptyState';
import { useLesson, useLessonTransactions, useStudent } from '@/db/hooks';
import { cancelLesson, markLessonConducted, recordLessonPayment, rescheduleLesson } from '@/db/mutations';
import { payStatusOf } from '@/domain/aggregates';
import { type PayStatus } from '@/domain/types';
import { useT } from '@/i18n';
import { formatRub } from '@/lib/format';
import { hhmm } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, Dot, Icon, Sheet, type DotTone } from '@/ui';

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
  const router = useRouter();
  const t = useT();
  const { colors, radius } = useTheme();
  const dateLabel = useDateLabel();

  const lesson = useLesson(id);
  const student = useStudent(lesson?.studentId ?? '');
  const txns = useLessonTransactions(id);
  const pay = payStatusOf(id, txns);

  const [rescheduling, setRescheduling] = useState(false);
  const [payingOpen, setPayingOpen] = useState(false);

  const conducted = lesson?.lifecycleStatus === 'done';

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('lesson.nom')} onBack={() => router.back()} />

      {!lesson ? (
        <EmptyState icon="calendar" text={t('common.none')} />
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
          </Card>

          <View style={styles.actions}>
            {conducted ? null : (
              <Pressable
                onPress={() => markLessonConducted(lesson)}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: colors.primary, borderRadius: radius.field },
                  pressed && styles.pressed,
                ]}>
                <Icon name="check" size={18} sw={2} stroke={colors.onTint} />
                <Text style={[styles.actionLabel, { color: colors.onTint }]}>{t('lesson.markDone')}</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => setPayingOpen(true)}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: colors.stoneLight, borderRadius: radius.field },
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

              <Pressable
                onPress={() => cancelLesson(lesson)}
                style={({ pressed }) => [
                  styles.action,
                  styles.actionGhost,
                  { backgroundColor: colors.dangerLight, borderRadius: radius.field },
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
            onPick={(ms) => rescheduleLesson(lesson, ms)}
          />

          {payingOpen ? (
            <Sheet title={t('lesson.recordPayment')} onClose={() => setPayingOpen(false)}>
              <View style={styles.paySheet}>
                <Pressable
                  onPress={() => {
                    void recordLessonPayment(lesson, { type: 'paid' });
                    setPayingOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.payChoice,
                    { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                    pressed && styles.pressed,
                  ]}>
                  <Dot tone="green" />
                  <Text style={[styles.payChoiceLabel, { color: colors.heading }]}>{t('pay.paid')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void recordLessonPayment(lesson, { type: 'debt' });
                    setPayingOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.payChoice,
                    { backgroundColor: colors.stoneLight, borderRadius: radius.field },
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
});
