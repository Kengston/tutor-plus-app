/**
 * StudentForm — shared create/edit form for Ученик/Клиент (dual-mode).
 *
 * Self-contained: owns the field state, renders its own compact back-header
 * (the student/* stack runs with headerShown:false), and hands the assembled
 * `StudentInput` back to the caller via `onSave`. The caller decides whether
 * that means createStudent or updateStudent — this component never writes.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createSubject } from '@/db/mutations';
import type { StudentInput } from '@/db/mutations';
import { useSubjects } from '@/db/hooks';
import type { LessonFormat, StudentStatus } from '@/domain/types';
import { useT } from '@/i18n';
import { catColors, useTheme, type CatColor } from '@/theme';
import { Icon } from '@/ui';

const CATEGORIES = Object.keys(catColors) as CatColor[];
const STATUSES: StudentStatus[] = ['active', 'paused', 'archived'];
const FORMATS: LessonFormat[] = ['online', 'inperson'];

export interface StudentFormProps {
  /** Pre-filled values when editing; absent fields fall back to sensible defaults. */
  initial?: Partial<StudentInput>;
  /** Present when editing — purely informational here (caller owns the write). */
  studentId?: string;
  /** Submit handler: receives the fully-assembled input. */
  onSave: (input: StudentInput) => void;
  /** Dismiss without saving (also fired after a successful save by callers). */
  onDone: () => void;
}

export function StudentForm({ initial, studentId, onSave, onDone }: StudentFormProps) {
  const t = useT();
  const { colors, radius } = useTheme();
  const allSubjects = useSubjects();
  const editing = studentId != null;

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<CatColor>(initial?.category ?? CATEGORIES[0]);
  const [status, setStatus] = useState<StudentStatus>(initial?.status ?? 'active');
  const [format, setFormat] = useState<LessonFormat>(initial?.format ?? 'online');
  // Rate kept as a string while typing; coerced to Number on save.
  const [rate, setRate] = useState(initial?.rate != null ? String(initial.rate) : '');
  const [schedule, setSchedule] = useState(initial?.schedule ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [subjectIds, setSubjectIds] = useState<string[]>(initial?.subjectIds ?? []);
  const [newSubject, setNewSubject] = useState('');

  const canSave = name.trim().length > 0;

  function toggleSubject(id: string) {
    setSubjectIds((ids) => (ids.includes(id) ? ids.filter((s) => s !== id) : [...ids, id]));
  }

  async function addSubject() {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    const created = await createSubject(trimmed);
    setNewSubject('');
    setSubjectIds((ids) => (ids.includes(created.id) ? ids : [...ids, created.id]));
  }

  function submit() {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      category,
      status,
      format,
      rate: Number(rate) || 0,
      schedule: schedule.trim(),
      phone: phone.trim(),
      subjectIds,
    });
  }

  // Shared styling for the plain text inputs (theme-driven, no literals).
  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        backgroundColor: colors.surface,
        borderColor: colors.hairline,
        borderRadius: radius.control,
        color: colors.heading,
      },
    ],
    [colors, radius],
  );

  const title = editing ? t('form.editTitle') : t('students.new');

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      {/* Compact header: back chevron + title + save (mirrors Screen.tsx shell). */}
      <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
        <Pressable
          onPress={onDone}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.back}>
          <Icon name="back" size={24} stroke={colors.heading} />
        </Pressable>
        <Text style={[styles.title, { color: colors.heading }]} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={submit}
          disabled={!canSave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          style={[
            styles.save,
            { backgroundColor: canSave ? colors.primary : colors.stoneLight, borderRadius: radius.pill },
          ]}>
          <Text style={[styles.saveLabel, { color: canSave ? colors.onTint : colors.label3 }]}>
            {t('common.save')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Name */}
        <Field label={t('field.name')}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('form.namePlaceholder')}
            placeholderTextColor={colors.muted}
            style={inputStyle}
            autoFocus={!editing}
            returnKeyType="next"
          />
        </Field>

        {/* Category — 6 colour swatches; selected gets a heading-coloured ring. */}
        <Field label={t('field.category')}>
          <View style={styles.swatches}>
            {CATEGORIES.map((c) => {
              const on = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: catColors[c].accent,
                      borderColor: on ? colors.heading : 'transparent',
                    },
                  ]}>
                  {on ? <Icon name="check" size={18} sw={2.4} stroke={colors.onTint} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Field>

        {/* Status */}
        <Field label={t('field.status')}>
          <Pillbar
            options={STATUSES.map((s) => ({ key: s, label: t(`status.${s}` as const) }))}
            active={status}
            onChange={setStatus}
          />
        </Field>

        {/* Default format for new lessons */}
        <Field label={t('field.format')}>
          <Pillbar
            options={FORMATS.map((f) => ({ key: f, label: t(`format.${f}` as const) }))}
            active={format}
            onChange={setFormat}
          />
        </Field>

        {/* Rate */}
        <Field label={t('lesson.rate')}>
          <TextInput
            value={rate}
            onChangeText={(v) => setRate(v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            style={inputStyle}
          />
        </Field>

        {/* Schedule */}
        <Field label={t('field.schedule')}>
          <TextInput
            value={schedule}
            onChangeText={setSchedule}
            placeholder={t('form.schedulePlaceholder')}
            placeholderTextColor={colors.muted}
            style={inputStyle}
          />
        </Field>

        {/* Phone */}
        <Field label={t('field.phone')}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+7"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={inputStyle}
          />
        </Field>

        {/* Subjects / directions — multi-select + inline add-new. */}
        <Field label={t('field.subjects')} hint={t('form.subjectsHint')}>
          <View style={styles.chips}>
            {allSubjects.map((s) => {
              const on = subjectIds.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggleSubject(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: on ? colors.accentSoft : colors.stoneLight,
                      borderColor: on ? colors.accent : 'transparent',
                      borderRadius: radius.pill,
                    },
                  ]}>
                  <Text
                    style={[styles.chipLabel, { color: on ? colors.heading : colors.stone700 }]}>
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.addRow}>
            <TextInput
              value={newSubject}
              onChangeText={setNewSubject}
              placeholder={t('form.addSubject')}
              placeholderTextColor={colors.muted}
              onSubmitEditing={addSubject}
              returnKeyType="done"
              style={[inputStyle, styles.addInput]}
            />
            <Pressable
              onPress={addSubject}
              disabled={!newSubject.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('form.addSubject')}
              style={[
                styles.addBtn,
                {
                  backgroundColor: newSubject.trim() ? colors.primary : colors.stoneLight,
                  borderRadius: radius.control,
                },
              ]}>
              <Icon
                name="plus"
                size={20}
                sw={2.2}
                stroke={newSubject.trim() ? colors.onTint : colors.label3}
              />
            </Pressable>
          </View>
        </Field>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Labelled field wrapper with an optional hint line under the label. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      {hint ? <Text style={[styles.fieldHint, { color: colors.label3 }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Generic single-select pill bar (keyed values, localized labels) — lets us
 * keep the underlying enum value separate from its display string, which the
 * label-based kit Segmented can't express.
 */
function Pillbar<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  const { colors, radius, shadow } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 3, padding: 3, backgroundColor: colors.stoneLight, borderRadius: radius.control }}>
      {options.map((o) => {
        const on = o.key === active;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[
              styles.pill,
              {
                backgroundColor: on ? colors.elev : 'transparent',
                borderRadius: radius.control - 3,
              },
              on ? { boxShadow: shadow.pill } : null,
            ]}>
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: on ? '600' : '500',
                color: on ? colors.heading : colors.muted,
              }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  save: { paddingHorizontal: 16, paddingVertical: 8 },
  saveLabel: { fontSize: 14.5, fontWeight: '600' },

  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 18 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '500' },
  fieldHint: { fontSize: 12, marginTop: -4 },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15.5,
  },

  swatches: { flexDirection: 'row', gap: 12 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  chipLabel: { fontSize: 13.5, fontWeight: '600' },

  addRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  addInput: { flex: 1 },
  addBtn: { width: 46, alignItems: 'center', justifyContent: 'center' },
});

export default StudentForm;
