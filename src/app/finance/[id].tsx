import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { useExpectation, useStudent, useStudentTransactions, useSubjects, useTransaction } from '@/db/hooks';
import { createTransaction, settleExpectationPaid } from '@/db/mutations';
import { openStandaloneDebts } from '@/domain/aggregates';
import type { PayMethod, PayStatus } from '@/domain/types';
import { useT } from '@/i18n';
import { formatRub } from '@/lib/format';
import { useBack } from '@/lib/nav';
import { hhmm } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, Chip, type ChipTone, Icon } from '@/ui';

/**
 * Finance entry detail (ADR-0011/0015) — drill-down for a TXN-sourced row OR an OPEN
 * `Expectation`. The Finance list routes lesson-sourced rows to `/lesson/[id]`; standalone /
 * settlement transactions come here as `id`, and open expectations as `id` + `kind='expectation'`.
 *
 * Money is APPEND-ONLY: a `debt` is settled by APPENDING a compensating `paid` txn (carrying the
 * same lessonId so the lesson's derived payStatus flips) — never by editing the original row. An
 * expectation settles the same way (a `paid` txn) but ALSO flips the expectation closed (ADR-0015).
 * Mirrors the custom Header + SafeAreaView shell from `lesson/[id].tsx`.
 */

/** RU date «8 июня» (genitive day-month) from a UTC-instant ms (device-local), via i18n month keys. */
function useDateLabel(): (ms: number) => string {
  const t = useT();
  return (ms: number) => {
    const d = new Date(ms);
    const month = t(`monthGen.${d.getMonth()}` as 'monthGen.0');
    return `${d.getDate()} ${month}`;
  };
}

/** kind → amount/status colour (paid→paid, debt→danger, expected→neutral, spec 07). */
function kindColor(kind: PayStatus, colors: { paid: string; danger: string; stone700: string }): string {
  return kind === 'paid' ? colors.paid : kind === 'debt' ? colors.danger : colors.stone700;
}

/** kind → chip tone (expected is neutral, spec 07). */
function kindTone(kind: PayStatus): ChipTone {
  return kind === 'paid' ? 'paid' : kind === 'debt' ? 'danger' : 'neutral';
}

export default function OperationDetailScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();
  const dateLabel = useDateLabel();

  // `id` is a transaction id, unless `kind='expectation'` — then it is an expectation id. Load the
  // matching entity (the other hook gets '' → stays undefined; established `?? ''` idiom in this repo).
  const isExpectation = kind === 'expectation';
  const txn = useTransaction(isExpectation ? '' : id);
  const expectation = useExpectation(isExpectation ? id : '');

  // The row's CURRENT state comes from the effective ledger, not the row itself: a debt txn
  // never mutates when settled (append-only), so «settled since» must be derived — same rule
  // as notification/[id].tsx (review fix S14). Without it the screen re-offered «Отметить
  // оплату» on an already-settled debt, appending income twice. For a standalone debt the
  // OUTSTANDING amount matters too: the Finance list shows the FIFO remainder (ADR-0011),
  // and the amount this screen shows/settles must be that same remainder — settling the
  // original full amount over a partial payment would mint phantom credit.
  const studentTxns = useStudentTransactions(txn?.studentId ?? '');
  const outstanding =
    txn?.type === 'debt'
      ? txn.lessonId != null
        ? studentTxns.some((x) => x.type === 'paid' && x.lessonId === txn.lessonId)
          ? 0
          : txn.amount
        : (openStandaloneDebts(studentTxns).get(txn.id) ?? 0)
      : 0;
  const debtSettled = txn?.type === 'debt' && outstanding === 0;

  // Normalise txn / expectation to one view — `canSettle` drives the «Отметить оплату» action.
  const view = useMemo<
    | { studentId: string; amount: number; dateMs: number; kind: PayStatus; method: PayMethod | null; subjectId: string | null; canSettle: boolean }
    | null
  >(() => {
    if (isExpectation) {
      if (!expectation) return null;
      return {
        studentId: expectation.studentId,
        amount: expectation.amount,
        dateMs: expectation.dueAt,
        kind: 'expected',
        method: null, // an expectation has no payment method until settled
        subjectId: null,
        // A closed expectation is history — its `paid` txn already shows in the list.
        canSettle: expectation.status === 'open',
      };
    }
    if (!txn) return null;
    // A real txn is paid | debt (`expected` is never stored, ADR-0008/0011); a debt is
    // settleable only while the effective ledger still carries it open, and it shows the
    // OUTSTANDING remainder — the exact amount «Отметить оплату» will append.
    return {
      studentId: txn.studentId,
      amount: txn.type === 'debt' && !debtSettled ? outstanding : txn.amount,
      dateMs: txn.occurredAt,
      kind: txn.type === 'debt' && debtSettled ? 'paid' : txn.type,
      method: txn.method,
      subjectId: txn.subjectId,
      canSettle: txn.type === 'debt' && !debtSettled,
    };
  }, [isExpectation, expectation, txn, debtSettled, outstanding]);

  // Owner + optional subject name (live subjects table; FK → row, no ORM join, ADR-0007).
  const student = useStudent(view?.studentId ?? '');
  const subjects = useSubjects();
  const subjectName = useMemo(() => {
    if (!view?.subjectId) return undefined;
    return subjects.find((s) => s.id === view.subjectId)?.name;
  }, [subjects, view]);

  const amountColor = view ? kindColor(view.kind, colors) : colors.heading;

  // In-flight guard: the derived `canSettle` flips only after the txn lands, so a double
  // tap before `goBack()` would append two settlements without it.
  const [settling, setSettling] = useState(false);

  /** Settle a debt or an expectation: APPEND a `paid` txn (an expectation also flips closed), then pop. */
  const markPaid = async () => {
    if (settling) return;
    if (isExpectation) {
      if (!expectation) return;
      setSettling(true);
      await settleExpectationPaid(expectation, { method: 'transfer' });
    } else {
      if (!txn || outstanding <= 0) return;
      setSettling(true);
      await createTransaction({
        studentId: txn.studentId,
        type: 'paid',
        // The FIFO remainder, not the original row amount — over a partial payment the
        // full amount would overpay and mint phantom standalone credit (ADR-0011).
        amount: outstanding,
        method: 'transfer',
        lessonId: txn.lessonId,
        subjectId: txn.subjectId,
      });
    }
    goBack();
  };

  /** Reach out to the student/client via the device dialer (paid-operation convenience). */
  const contact = () => {
    if (student?.phone) void Linking.openURL(`tel:${student.phone}`);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('finance.opTitle')} onBack={() => goBack()} />

      {!view ? (
        <EmptyState icon="wallet" text={t('common.none')} />
      ) : (
        <View style={styles.content}>
          {/* Hero: signed amount (leading «+» for income) + the type chip. */}
          <View style={styles.hero}>
            <Text style={[styles.amount, { color: amountColor }]}>
              {view.kind === 'paid' ? '+' : ''}
              {formatRub(view.amount)}
            </Text>
            <View style={styles.chipRow}>
              <Chip tone={kindTone(view.kind)}>{t(`pay.${view.kind}` as 'pay.paid')}</Chip>
            </View>
          </View>

          {/* Info card — Field/Hairline rows (mirrors lesson/[id].tsx). */}
          <Card style={styles.card}>
            <Field label={t('field.student')} value={student?.name ?? t('common.none')} />
            <Hairline />
            {/* Expectation carries a date only (no wall-clock time); a txn shows date · time. */}
            <Field
              label={t('field.date')}
              value={isExpectation ? dateLabel(view.dateMs) : `${dateLabel(view.dateMs)} · ${hhmm(view.dateMs)}`}
            />
            <Hairline />
            <Field
              label={t('finance.method')}
              value={view.method ? t(`method.${view.method}` as 'method.transfer') : t('common.none')}
            />
            {subjectName ? (
              <>
                <Hairline />
                <Field label={t('finance.subject')} value={subjectName} />
              </>
            ) : null}
            <Hairline />
            <Field label={t('finance.status')}>
              <Text style={[styles.value, { color: amountColor }]}>{t(`pay.${view.kind}` as 'pay.paid')}</Text>
            </Field>
          </Card>

          {/* Action — settle a debt/expectation (primary), or contact for a recorded payment. */}
          {view.canSettle ? (
            <Pressable
              onPress={markPaid}
              disabled={settling}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: colors.primary, borderRadius: radius.field },
                (pressed || settling) && styles.pressed,
              ]}>
              <Icon name="check" size={18} sw={1.9} stroke={colors.onTint} />
              <Text style={[styles.actionLabel, { color: colors.onTint }]}>{t('finance.markPaidCta')}</Text>
            </Pressable>
          ) : student?.phone ? (
            <Pressable
              onPress={contact}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                pressed && styles.pressed,
              ]}>
              <Icon name="phone" size={18} sw={1.8} stroke={colors.body} />
              <Text style={[styles.actionLabel, { color: colors.body }]}>{t('common.contact')}</Text>
            </Pressable>
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
      {children ?? <Text numberOfLines={1} style={[styles.value, { color: colors.heading }]}>{value}</Text>}
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
  hero: { alignItems: 'center', paddingTop: 10, paddingBottom: 6, gap: 12 },
  amount: { fontSize: 38, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  chipRow: { flexDirection: 'row', justifyContent: 'center' },
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
