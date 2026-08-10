import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerSheet } from '@/components/DateTimePickerSheet';
import { useProfile, useStudents, useSubjects } from '@/db/hooks';
import { createLesson, recordLessonPayment } from '@/db/mutations';
import { DURATIONS, type Duration, type LessonFormat, type PayStatus } from '@/domain/types';
import { useT } from '@/i18n';
import { useBack } from '@/lib/nav';
import { dayBounds, hhmm, nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { CatAvatar, Icon, Segmented, Sheet, Text, TextInput } from '@/ui';

/** Today's next whole hour as a UTC-instant ms (device-local), via dayBounds + offset. */
function defaultStartsAt(): number {
  const d = new Date(nowMs());
  const nextHour = Math.min(23, d.getMinutes() > 0 ? d.getHours() + 1 : d.getHours());
  return dayBounds(nowMs()).start + nextHour * 3_600_000;
}

export default function LessonFormScreen() {
  // `at` prefills date/time (tap on a free window, spec 05 §5.2); `studentId` presets the student.
  const { studentId: preselect, at } = useLocalSearchParams<{ studentId?: string; at?: string }>();
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();

  const students = useStudents();
  const subjects = useSubjects();
  const profile = useProfile();

  const [studentId, setStudentId] = useState<string | undefined>(preselect);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [startsAt, setStartsAt] = useState<number>(() => {
    const prefill = Number(at);
    return Number.isFinite(prefill) && prefill > 0 ? prefill : defaultStartsAt();
  });
  const [duration, setDuration] = useState<Duration>(60);
  const [format, setFormat] = useState<LessonFormat>('online');
  const [link, setLink] = useState('');
  const [price, setPrice] = useState<string>('');
  const [priceTouched, setPriceTouched] = useState(false);
  // Payment status at creation (spec 05 §5.3). Default «Ожидается» is DERIVED — no txn
  // is written; «Оплачено»/«Долг» append the corresponding ledger row (ADR-0008).
  const [payStatus, setPayStatus] = useState<PayStatus>('expected');

  // Registration-wizard defaults (spec 03 §3.4-5, v11): seed duration/format/price ONCE when
  // the profile row arrives and the fields are still untouched (render-time state-adjustment
  // idiom — the row loads async, so useState initializers can't see it).
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  if (profile && !defaultsApplied) {
    setDefaultsApplied(true);
    const dd = profile.defaultDuration;
    if (dd != null && (DURATIONS as readonly number[]).includes(dd)) setDuration(dd as Duration);
    if (profile.defaultFormat === 'online' || profile.defaultFormat === 'inperson') {
      setFormat(profile.defaultFormat);
    }
    // defaultRate flows through the effectivePrice fallback chain below (student rate wins).
  }

  const [pickStudent, setPickStudent] = useState(false);
  const [pickSubject, setPickSubject] = useState(false);
  const [pickWhen, setPickWhen] = useState(false);

  const selectedStudent = students.find((s) => s.id === studentId);
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // Price tracks the selected student's rate until the user types a value; with no student
  // picked yet, the registration-wizard default rate fills in (spec 03 §3.4-5, review fix S17).
  const effectivePrice = priceTouched ? price : String(selectedStudent?.rate ?? profile?.defaultRate ?? '');

  const canSave = !!studentId;

  const onSave = async () => {
    if (!studentId) return;
    const parsed = parseInt(effectivePrice.replace(/\D/g, ''), 10);
    const lesson = await createLesson({
      studentId,
      subjectId,
      topic: topic.trim(),
      startsAt,
      durationMin: duration,
      format,
      price: Number.isNaN(parsed) ? 0 : parsed,
      link: link.trim() || null,
    });
    // «Ожидается» is the derived default (no row); paid/debt append a ledger txn.
    if (payStatus !== 'expected') {
      await recordLessonPayment(lesson, { type: payStatus });
    }
    goBack();
  };

  const payLabels: Record<PayStatus, string> = {
    paid: t('pay.paid'),
    expected: t('pay.expected'),
    debt: t('pay.debt'),
  };

  const durationLabels = DURATIONS.map((d) => `${d} ${t('common.min')}`);
  const formatLabels: Record<LessonFormat, string> = {
    online: t('format.online'),
    inperson: t('format.inperson'),
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => goBack()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}>
          <Icon name="back" size={20} stroke={colors.heading} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.heading }]}>{t('lesson.create')}</Text>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <PickerField
          label={t('field.student')}
          value={selectedStudent?.name}
          placeholder={t('lesson.choose')}
          onPress={() => setPickStudent(true)}
        />

        <PickerField
          label={t('lesson.subject')}
          value={selectedSubject?.name}
          placeholder={t('common.none')}
          onPress={() => setPickSubject(true)}
        />

        <FieldBlock label={t('field.topic')}>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder={t('lesson.topicPlaceholder')}
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              { borderRadius: radius.control, color: colors.heading, backgroundColor: colors.elev, borderColor: colors.hairline },
            ]}
          />
        </FieldBlock>

        <PickerField
          label={t('field.date')}
          value={`${new Date(startsAt).getDate()} ${t(`monthGen.${new Date(startsAt).getMonth()}` as 'monthGen.0')}, ${hhmm(startsAt)}`}
          placeholder={t('field.date')}
          onPress={() => setPickWhen(true)}
        />

        <FieldBlock label={t('field.duration')}>
          <Segmented
            tabs={durationLabels}
            active={`${duration} ${t('common.min')}`}
            onChange={(tab) => setDuration(parseInt(tab, 10) as Duration)}
          />
        </FieldBlock>

        <FieldBlock label={t('field.format')}>
          <Segmented
            tabs={[formatLabels.online, formatLabels.inperson]}
            active={formatLabels[format]}
            onChange={(tab) => setFormat(tab === formatLabels.inperson ? 'inperson' : 'online')}
          />
        </FieldBlock>

        {/* Meeting link (delta v2.1 §3.1) — optional; prominent right under «Формат»
            for online lessons (spec: «опционально для очного, заметно для онлайн»). */}
        <FieldBlock label={t('lesson.linkField')}>
          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder={format === 'online' ? 'https://meet.google.com/…' : ''}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[
              styles.input,
              { borderRadius: radius.control, color: colors.heading, backgroundColor: colors.elev, borderColor: colors.hairline },
            ]}
          />
        </FieldBlock>

        <FieldBlock label={t('field.cost')}>
          <TextInput
            value={effectivePrice}
            onChangeText={(v) => {
              setPriceTouched(true);
              setPrice(v.replace(/\D/g, ''));
            }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              { borderRadius: radius.control, color: colors.heading, backgroundColor: colors.elev, borderColor: colors.hairline },
            ]}
          />
        </FieldBlock>

        {/* Payment status (spec 05 §5.3): «Оплачено / Ожидается / Долг». */}
        <FieldBlock label={t('lesson.payStatus')}>
          <Segmented
            tabs={[payLabels.paid, payLabels.expected, payLabels.debt]}
            active={payLabels[payStatus]}
            onChange={(tab) =>
              setPayStatus(tab === payLabels.paid ? 'paid' : tab === payLabels.debt ? 'debt' : 'expected')
            }
          />
        </FieldBlock>
      </ScrollView>

      {/* Full-width «Создать урок» CTA pinned at the bottom (spec 05 §5.3),
          disabled until the required fields are filled. */}
      <View style={[styles.footer, { borderTopColor: colors.hairline, backgroundColor: colors.bg }]}>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel={t('lesson.create')}
          style={({ pressed }) => [
            styles.createBtn,
            { backgroundColor: colors.primary, borderRadius: radius.field, opacity: canSave ? (pressed ? 0.85 : 1) : 0.4 },
          ]}>
          <Text style={[styles.createLabel, { color: colors.onTint }]}>{t('lesson.create')}</Text>
        </Pressable>
      </View>

      {pickStudent && (
        <Sheet title={t('lesson.choose')} onClose={() => setPickStudent(false)}>
          {students.length === 0 ? (
            <Text style={[styles.sheetEmpty, { color: colors.muted }]}>{t('students.empty')}</Text>
          ) : (
            students.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  setStudentId(s.id);
                  setPickStudent(false);
                }}
                style={({ pressed }) => [styles.optRow, pressed && styles.pressed]}>
                <CatAvatar initials={s.initials} cat={s.category} size={34} />
                <Text style={[styles.optText, { color: colors.heading }]}>{s.name}</Text>
                {s.id === studentId && <Icon name="check" size={18} sw={2} stroke={colors.primary} />}
              </Pressable>
            ))
          )}
        </Sheet>
      )}

      {pickSubject && (
        <Sheet title={t('lesson.subject')} onClose={() => setPickSubject(false)}>
          <Pressable
            onPress={() => {
              setSubjectId(null);
              setPickSubject(false);
            }}
            style={({ pressed }) => [styles.optRow, pressed && styles.pressed]}>
            <Text style={[styles.optText, { color: colors.muted }]}>{t('common.none')}</Text>
            {subjectId === null && <Icon name="check" size={18} sw={2} stroke={colors.primary} />}
          </Pressable>
          {subjects.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                setSubjectId(s.id);
                setPickSubject(false);
              }}
              style={({ pressed }) => [styles.optRow, pressed && styles.pressed]}>
              <Text style={[styles.optText, { color: colors.heading }]}>{s.name}</Text>
              {s.id === subjectId && <Icon name="check" size={18} sw={2} stroke={colors.primary} />}
            </Pressable>
          ))}
        </Sheet>
      )}

      <DateTimePickerSheet
        visible={pickWhen}
        initial={startsAt}
        withTime
        title={t('field.date')}
        onClose={() => setPickWhen(false)}
        onPick={setStartsAt}
      />
    </SafeAreaView>
  );
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

function PickerField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <FieldBlock label={label}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.input,
          styles.pickerRow,
          { borderRadius: radius.control, backgroundColor: colors.elev, borderColor: colors.hairline },
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.pickerValue, { color: value ? colors.heading : colors.label3 }]} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <Icon name="chevronDown" size={18} stroke={colors.label3} />
      </Pressable>
    </FieldBlock>
  );
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
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  body: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32, gap: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18, borderTopWidth: StyleSheet.hairlineWidth },
  createBtn: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  createLabel: { fontSize: 16, fontWeight: '600' },
  fieldBlock: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pickerValue: { flex: 1, fontSize: 15, fontWeight: '500' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  optText: { flex: 1, fontSize: 15.5, fontWeight: '500' },
  sheetEmpty: { fontSize: 14.5, paddingVertical: 20, textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
