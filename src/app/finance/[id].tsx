import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { useStudent, useSubjects, useTransaction } from '@/db/hooks';
import { createTransaction } from '@/db/mutations';
import { useT } from '@/i18n';
import { formatRub } from '@/lib/format';
import { hhmm } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, Chip, Icon } from '@/ui';

/**
 * Finance operation detail (ADR-0011) — drill-down for a TXN-sourced Finance row.
 * The Finance list routes lesson-sourced rows to `/lesson/[id]` and only standalone /
 * settlement transactions here, so `id` is always a transaction id.
 *
 * Money is APPEND-ONLY: a `debt` is settled by APPENDING a compensating `paid` txn
 * (carrying the same lessonId so the lesson's derived payStatus flips) — never by editing
 * the original row. Mirrors the custom Header + SafeAreaView shell from `lesson/[id].tsx`.
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

export default function OperationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const { colors, radius } = useTheme();
  const dateLabel = useDateLabel();

  // `id` is a transaction id (txn-sourced Finance rows route here); the student owns the operation.
  const txn = useTransaction(id);
  const student = useStudent(txn?.studentId ?? '');

  // Resolve the optional subject NAME via the live subjects table (FK → row, no ORM join, ADR-0007).
  const subjects = useSubjects();
  const subjectName = useMemo(() => {
    if (!txn?.subjectId) return undefined;
    return subjects.find((s) => s.id === txn.subjectId)?.name;
  }, [subjects, txn?.subjectId]);

  // `expected` is never a stored row (ADR-0008/0011) → a real txn is paid | debt. Treat paid specially,
  // everything else (debt) takes the danger styling + the settle action.
  const isPaid = txn?.type === 'paid';
  const amountColor = isPaid ? colors.paid : colors.danger;

  /** Settle a debt: APPEND a `paid` txn carrying the debt's lesson/subject links, then pop. */
  const markPaid = async () => {
    if (!txn) return;
    await createTransaction({
      studentId: txn.studentId,
      type: 'paid',
      amount: txn.amount,
      method: 'transfer',
      lessonId: txn.lessonId,
      subjectId: txn.subjectId,
    });
    router.back();
  };

  /** Reach out to the student/client via the device dialer (paid-operation convenience). */
  const contact = () => {
    if (student?.phone) void Linking.openURL(`tel:${student.phone}`);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('finance.opTitle')} onBack={() => router.back()} />

      {!txn ? (
        <EmptyState icon="wallet" text={t('common.none')} />
      ) : (
        <View style={styles.content}>
          {/* Hero: signed amount (leading «+» for income) + the type chip. */}
          <View style={styles.hero}>
            <Text style={[styles.amount, { color: amountColor }]}>
              {isPaid ? '+' : ''}
              {formatRub(txn.amount)}
            </Text>
            <View style={styles.chipRow}>
              <Chip tone={isPaid ? 'paid' : 'danger'}>{t(`pay.${txn.type}` as 'pay.paid')}</Chip>
            </View>
          </View>

          {/* Info card — Field/Hairline rows (mirrors lesson/[id].tsx). */}
          <Card style={styles.card}>
            <Field label={t('field.student')} value={student?.name ?? t('common.none')} />
            <Hairline />
            <Field label={t('field.date')} value={`${dateLabel(txn.occurredAt)} · ${hhmm(txn.occurredAt)}`} />
            <Hairline />
            <Field
              label={t('finance.method')}
              value={txn.method ? t(`method.${txn.method}` as 'method.transfer') : t('common.none')}
            />
            {subjectName ? (
              <>
                <Hairline />
                <Field label={t('finance.subject')} value={subjectName} />
              </>
            ) : null}
            <Hairline />
            <Field label={t('finance.status')}>
              <Text style={[styles.value, { color: amountColor }]}>{t(`pay.${txn.type}` as 'pay.paid')}</Text>
            </Field>
          </Card>

          {/* Action — settle a debt (primary), or contact for a recorded payment. */}
          {txn.type === 'debt' ? (
            <Pressable
              onPress={markPaid}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: colors.primary, borderRadius: radius.field },
                pressed && styles.pressed,
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
