/**
 * «Новая операция» — the general money-write screen (ADR-0011). Appends a standalone
 * transaction (Оплата → `type:'paid'` / Долг → `type:'debt'`) via `createTransaction`
 * (money is APPEND-ONLY; this only ever CREATES a row). No «Ожидается» here — `expected`
 * is a DERIVED state, never a stored row (ADR-0011), so the type picker offers paid/debt only.
 *
 * Shell mirrors lesson/[id].tsx: a custom Header (this stack has headerShown:false) inside a
 * SafeAreaView; the body is a ScrollView so the lower fields/keyboard stay reachable. Pickers
 * reuse the shared kit Sheet (student/subject) and DateTimePickerSheet (date) — no new sheets.
 * All strings via i18n (dual-mode resolves inside t()); all colours via theme tokens.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerSheet } from '@/components/DateTimePickerSheet';
import { useStudents, useSubjects } from '@/db/hooks';
import { createTransaction } from '@/db/mutations';
import type { PayMethod } from '@/domain/types';
import { useT, type StringKey } from '@/i18n';
import { formatNumberRu } from '@/lib/format';
import { nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, Chip, Icon, SectionLabel, Sheet } from '@/ui';

/** Stored transaction kinds for this form (`expected` is derived, never written — ADR-0011). */
type OpType = 'paid' | 'debt';

/** RU date «8 июня» (genitive day-month) from a UTC-instant ms (device-local) — same pattern as lesson/[id].tsx. */
function useDateLabel(): (ms: number) => string {
  const t = useT();
  return (ms: number) => {
    const d = new Date(ms);
    const month = t(`monthGen.${d.getMonth()}` as 'monthGen.0');
    return `${d.getDate()} ${month}`;
  };
}

/** Payment methods, in display order — only relevant for `paid` operations. */
const METHODS: { key: PayMethod; label: StringKey }[] = [
  { key: 'transfer', label: 'method.transfer' },
  { key: 'cash', label: 'method.cash' },
  { key: 'card', label: 'method.card' },
];

export default function NewOperationScreen() {
  const router = useRouter();
  const t = useT();
  const { colors, radius } = useTheme();
  const dateLabel = useDateLabel();

  const students = useStudents();
  const subjects = useSubjects();

  // ── Form state ──
  const [type, setType] = useState<OpType>('paid');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<PayMethod>('transfer');
  const [occurredAt, setOccurredAt] = useState<number>(() => nowMs());
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [comment, setComment] = useState<string>('');

  // ── Picker visibility ──
  const [studentPicker, setStudentPicker] = useState(false);
  const [datePicker, setDatePicker] = useState(false);
  const [subjectPicker, setSubjectPicker] = useState(false);

  // Amount preview colour follows the operation type (income vs. owed).
  const previewColor = type === 'paid' ? colors.paid : colors.danger;
  // Chosen entities (undefined until a row is tapped → placeholder shown).
  const student = students.find((s) => s.id === studentId);
  const subject = subjects.find((s) => s.id === subjectId);

  // Save is gated: a counterparty must be chosen and the amount must be positive.
  const canSave = studentId != null && amount > 0;

  const save = async () => {
    if (!canSave || studentId == null) return;
    await createTransaction({
      studentId,
      type,
      amount,
      // Method only makes sense for an actual payment; a debt has none.
      method: type === 'paid' ? method : null,
      occurredAt,
      subjectId: subjectId ?? null,
      comment: comment || null,
    });
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('finance.newOp')} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* ── Amount preview (centred, large) ───────────────────────────────── */}
        <View style={styles.preview}>
          <Text style={[styles.previewAmount, { color: previewColor }]}>
            {`${formatNumberRu(amount)} ₽`}
          </Text>
          <View style={styles.previewChip}>
            <Chip tone={type === 'paid' ? 'paid' : 'danger'}>{t(type === 'paid' ? 'op.paid' : 'op.debt')}</Chip>
          </View>
        </View>

        {/* ── Тип операции (paid / debt) ────────────────────────────────────── */}
        <SectionLabel>{t('finance.opType')}</SectionLabel>
        <View style={styles.btnRow}>
          {(['paid', 'debt'] as const).map((k) => {
            const on = k === type;
            return (
              <Pressable
                key={k}
                onPress={() => setType(k)}
                style={({ pressed }) => [
                  styles.choiceBtn,
                  {
                    backgroundColor: on ? colors.primaryVlight : colors.surface,
                    borderColor: on ? colors.primary : colors.hairline,
                    borderRadius: radius.field,
                  },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.choiceLabel, { color: on ? colors.primary : colors.body }]}>
                  {t(k === 'paid' ? 'op.paid' : 'op.debt')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Main fields: student · date · amount ──────────────────────────── */}
        <Card style={styles.card}>
          <Pressable
            onPress={() => setStudentPicker(true)}
            style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('field.student')}</Text>
            <Text
              numberOfLines={1}
              style={[styles.rowValue, { color: student ? colors.heading : colors.stoneInactive }]}>
              {student?.name ?? t('finance.chooseStudent')}
            </Text>
            <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
          </Pressable>

          <Hairline />

          <Pressable
            onPress={() => setDatePicker(true)}
            style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('field.date')}</Text>
            <Text style={[styles.rowValue, { color: colors.heading }]}>{dateLabel(occurredAt)}</Text>
            <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
          </Pressable>

          <Hairline />

          {/* Сумма — inline numeric input (digits only). */}
          <View style={styles.pickRow}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('finance.amount')}</Text>
            <TextInput
              value={amount > 0 ? String(amount) : ''}
              onChangeText={(s) => setAmount(Number(s.replace(/\D/g, '')) || 0)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.stoneInactive}
              style={[styles.amountInput, { color: colors.heading }]}
            />
          </View>
        </Card>

        {/* ── Способ оплаты (only for an actual payment) ────────────────────── */}
        {type === 'paid' ? (
          <>
            <SectionLabel>{t('finance.method')}</SectionLabel>
            <View style={styles.btnRow}>
              {METHODS.map(({ key, label }) => {
                const on = key === method;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setMethod(key)}
                    style={({ pressed }) => [
                      styles.choiceBtn,
                      {
                        backgroundColor: on ? colors.primaryVlight : colors.surface,
                        borderColor: on ? colors.primary : colors.hairline,
                        borderRadius: radius.field,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.choiceLabel, { color: on ? colors.primary : colors.body }]}>{t(label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* ── Optional: subject (picker) + free-text comment ────────────────── */}
        <Card style={styles.card}>
          <Pressable
            onPress={() => setSubjectPicker(true)}
            style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('finance.subject')}</Text>
            <Text
              numberOfLines={1}
              style={[styles.rowValue, { color: subject ? colors.heading : colors.stoneInactive }]}>
              {subject?.name ?? t('finance.optional')}
            </Text>
            <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
          </Pressable>

          <Hairline />

          <View style={styles.pickRow}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('finance.comment')}</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t('finance.optional')}
              placeholderTextColor={colors.stoneInactive}
              style={[styles.commentInput, { color: colors.heading }]}
            />
          </View>
        </Card>

        {/* ── Save (append the transaction) ─────────────────────────────────── */}
        <Pressable
          onPress={() => void save()}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: canSave ? colors.primary : colors.stoneLight,
              borderRadius: radius.field,
            },
            pressed && canSave && styles.pressed,
          ]}>
          <Text style={[styles.saveLabel, { color: canSave ? colors.onTint : colors.stoneInactive }]}>
            {t('finance.saveOp')}
          </Text>
        </Pressable>
      </ScrollView>

      {/* ── Student picker — kit Sheet over useStudents() ─────────────────────── */}
      {studentPicker ? (
        <Sheet title={t('field.student')} onClose={() => setStudentPicker(false)}>
          <Card>
            {students.map((s, i) => {
              const on = s.id === studentId;
              return (
                <View key={s.id}>
                  {i > 0 ? <Hairline /> : null}
                  <Pressable
                    onPress={() => {
                      setStudentId(s.id);
                      setStudentPicker(false);
                    }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      on && { backgroundColor: colors.primaryVlight },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.optionLabel, { color: colors.heading }]}>{s.name}</Text>
                    {on ? <Icon name="check" size={18} sw={2} stroke={colors.primary} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </Sheet>
      ) : null}

      {/* ── Subject picker — kit Sheet over useSubjects() ────────────────────── */}
      {subjectPicker ? (
        <Sheet title={t('finance.subject')} onClose={() => setSubjectPicker(false)}>
          <Card>
            {subjects.map((s, i) => {
              const on = s.id === subjectId;
              return (
                <View key={s.id}>
                  {i > 0 ? <Hairline /> : null}
                  <Pressable
                    onPress={() => {
                      // Tapping the chosen subject again clears it (back to «Необязательно»).
                      setSubjectId(on ? null : s.id);
                      setSubjectPicker(false);
                    }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      on && { backgroundColor: colors.primaryVlight },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.optionLabel, { color: colors.heading }]}>{s.name}</Text>
                    {on ? <Icon name="check" size={18} sw={2} stroke={colors.primary} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </Sheet>
      ) : null}

      {/* ── Date picker — shared kit sheet, date only (UTC-ms instant) ────────── */}
      <DateTimePickerSheet
        visible={datePicker}
        withTime={false}
        initial={occurredAt}
        title={t('field.date')}
        onClose={() => setDatePicker(false)}
        onPick={(ms) => setOccurredAt(ms)}
      />
    </SafeAreaView>
  );
}

/** Compact stack header (this stack has headerShown:false) — mirrors lesson/[id].tsx. */
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

/** Hairline divider — same token + thickness as lesson/[id].tsx. */
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
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 14 },

  // amount preview
  preview: { alignItems: 'center', paddingTop: 4, paddingBottom: 6, gap: 10 },
  previewAmount: { fontSize: 36, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  previewChip: { flexDirection: 'row', justifyContent: 'center' },

  // inline choice button rows (type / method)
  btnRow: { flexDirection: 'row', gap: 9 },
  choiceBtn: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  choiceLabel: { fontSize: 14.5, fontWeight: '600' },

  // field cards
  card: { paddingHorizontal: 14 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowLabel: { fontSize: 14, fontWeight: '500', flexShrink: 0 },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600' },
  amountInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  commentInput: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  hairline: { height: StyleSheet.hairlineWidth },

  // picker sheet rows
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  optionLabel: { fontSize: 15, fontWeight: '500' },

  // save
  save: { height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveLabel: { fontSize: 15.5, fontWeight: '700' },

  pressed: { opacity: 0.85 },
});
