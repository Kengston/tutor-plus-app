import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTimePickerSheet } from '@/components/DateTimePickerSheet';
import { useStudents, useSubjects } from '@/db/hooks';
import { createLesson } from '@/db/mutations';
import { DURATIONS, type Duration, type LessonFormat } from '@/domain/types';
import { useT } from '@/i18n';
import { dayBounds, hhmm, nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { CatAvatar, Icon, Segmented, Sheet } from '@/ui';

/** Today's next whole hour as a UTC-instant ms (device-local), via dayBounds + offset. */
function defaultStartsAt(): number {
  const d = new Date(nowMs());
  const nextHour = Math.min(23, d.getMinutes() > 0 ? d.getHours() + 1 : d.getHours());
  return dayBounds(nowMs()).start + nextHour * 3_600_000;
}

export default function LessonFormScreen() {
  const { studentId: preselect } = useLocalSearchParams<{ studentId?: string }>();
  const router = useRouter();
  const t = useT();
  const { colors } = useTheme();

  const students = useStudents();
  const subjects = useSubjects();

  const [studentId, setStudentId] = useState<string | undefined>(preselect);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [startsAt, setStartsAt] = useState<number>(defaultStartsAt);
  const [duration, setDuration] = useState<Duration>(60);
  const [format, setFormat] = useState<LessonFormat>('online');
  const [price, setPrice] = useState<string>('');
  const [priceTouched, setPriceTouched] = useState(false);

  const [pickStudent, setPickStudent] = useState(false);
  const [pickSubject, setPickSubject] = useState(false);
  const [pickWhen, setPickWhen] = useState(false);

  const selectedStudent = students.find((s) => s.id === studentId);
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // Price tracks the selected student's rate until the user types a value.
  const effectivePrice = priceTouched ? price : String(selectedStudent?.rate ?? '');

  const canSave = !!studentId;

  const onSave = async () => {
    if (!studentId) return;
    const parsed = parseInt(effectivePrice.replace(/\D/g, ''), 10);
    await createLesson({
      studentId,
      subjectId,
      topic: topic.trim(),
      startsAt,
      durationMin: duration,
      format,
      price: Number.isNaN(parsed) ? 0 : parsed,
    });
    router.back();
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
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}>
          <Icon name="back" size={20} stroke={colors.heading} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.heading }]}>{t('lesson.create')}</Text>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          hitSlop={8}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: canSave ? (pressed ? 0.85 : 1) : 0.4 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('common.save')}>
          <Text style={[styles.saveLabel, { color: colors.onTint }]}>{t('common.save')}</Text>
        </Pressable>
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
            placeholderTextColor={colors.label3}
            style={[styles.input, { color: colors.heading, backgroundColor: colors.elev, borderColor: colors.hairline }]}
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

        <FieldBlock label={t('field.cost')}>
          <TextInput
            value={effectivePrice}
            onChangeText={(v) => {
              setPriceTouched(true);
              setPrice(v.replace(/\D/g, ''));
            }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.label3}
            style={[styles.input, { color: colors.heading, backgroundColor: colors.elev, borderColor: colors.hairline }]}
          />
        </FieldBlock>
      </ScrollView>

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
  const { colors } = useTheme();
  return (
    <FieldBlock label={label}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.input,
          styles.pickerRow,
          { backgroundColor: colors.elev, borderColor: colors.hairline },
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
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  saveLabel: { fontSize: 14.5, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32, gap: 16 },
  fieldBlock: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
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
