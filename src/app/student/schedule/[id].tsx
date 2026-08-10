/**
 * Schedule-slots editor (UI-v2 S6, ADR-0016) — a student's recurring series. Lists the
 * student's active slots and lets them add / edit / close one; every change re-runs the
 * rolling-window materializer so the timeline reflects it immediately. Weekday/time are
 * local wall-clock; duration/format default from the student, overridable on the slot.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { useStudent, useStudentSlots } from '@/db/hooks';
import type { ScheduleSlotModel } from '@/db/models';
import { closeSlot, createSlot, materializeSchedule, updateSlot } from '@/db/slots';
import { DURATIONS, type Duration, type LessonFormat } from '@/domain/types';
import { useT, type StringKey } from '@/i18n';
import { backOrHome } from '@/lib/nav';
import { nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { Icon, PlusStroke, Segmented, Sheet, Text, TextInput } from '@/ui';

/** «16:00» from minutes-since-midnight. */
function timeLabel(timeMin: number): string {
  const h = Math.floor(timeMin / 60);
  const m = timeMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Clamp a numeric string field to [0, max]. */
function clampInt(s: string, max: number): number {
  const n = parseInt(s.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : Math.min(Math.max(n, 0), max);
}
const pad2 = (n: number) => String(n).padStart(2, '0');

/** JS getDay index (0=Sun … 6=Sat) → the short weekday i18n key. */
function weekdayKey(weekday: number): StringKey {
  return `wd.${weekday}` as StringKey;
}

export default function ScheduleSlotsScreen() {
  const t = useT();
  const { colors, radius } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');

  const student = useStudent(id);
  const slots = useStudentSlots(id);
  const now = nowMs();
  // Active slots only (open-ended or not yet closed).
  const active = slots.filter((s) => s.activeTo === null || s.activeTo > now);

  const [editing, setEditing] = useState<ScheduleSlotModel | null>(null);
  const [adding, setAdding] = useState(false);
  // Slot pending close confirmation: closing a slot also drops its future materialized
  // lessons (db/slots.closeSlot), so the «×» must not fire from a single stray tap.
  const [closing, setClosing] = useState<ScheduleSlotModel | null>(null);

  if (!student) {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
        <Header title={t('slots.title')} />
        <EmptyState icon="users" text={t('common.none')} />
      </SafeAreaView>
    );
  }

  const confirmClose = () => {
    if (!closing) return;
    void closeSlot(closing).then(materializeSchedule);
    setClosing(null);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('slots.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {active.length === 0 ? (
          <EmptyState icon="calendar" text={t('slots.empty')} />
        ) : (
          <View style={styles.list}>
            {active.map((slot) => (
              <View
                key={slot.id}
                style={[styles.slotRow, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field }]}>
                <Pressable style={styles.slotMain} onPress={() => setEditing(slot)} accessibilityRole="button">
                  <Text style={[styles.slotWeekday, { color: colors.heading }]}>{t(weekdayKey(slot.weekday))}</Text>
                  <Text style={[styles.slotTime, { color: colors.heading }]}>{timeLabel(slot.timeMin)}</Text>
                  <Text style={[styles.slotMeta, { color: colors.muted }]}>
                    {slot.durationMin} {t('common.min')} · {t(slot.format === 'online' ? 'format.online' : 'format.inperson')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setClosing(slot)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('slots.close')}
                  style={({ pressed }) => [styles.slotClose, pressed && styles.pressed]}>
                  <Icon name="close" size={18} sw={2} stroke={colors.stoneInactive} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primaryVlight, borderRadius: radius.field },
            pressed && styles.pressed,
          ]}>
          {/* Жест «добавить» — рукописный росчерк (канон §10, слайс #75). */}
          <PlusStroke size="marker" px={18} color={colors.primaryDeep} />
          <Text style={[styles.addLabel, { color: colors.primaryDeep }]}>{t('slots.add')}</Text>
        </Pressable>
      </ScrollView>

      {adding ? (
        <SlotFormSheet
          title={t('slots.add')}
          defaults={{ weekday: 1, timeMin: 16 * 60, durationMin: 60, format: student.format }}
          onClose={() => setAdding(false)}
          onSubmit={(v) => {
            void createSlot({
              studentId: id,
              weekday: v.weekday,
              timeMin: v.timeMin,
              durationMin: v.durationMin,
              format: v.format,
              price: student.rate,
              subjectId: null,
            }).then(materializeSchedule);
            setAdding(false);
          }}
        />
      ) : null}

      {closing ? (
        <Sheet title={t('slots.close')} onClose={() => setClosing(null)}>
          <Text style={[styles.confirmText, { color: colors.body }]}>{t('slots.removeConfirm')}</Text>
          <View style={styles.confirmRow}>
            <Pressable
              onPress={() => setClosing(null)}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.confirmLabel, { color: colors.heading }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={confirmClose}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: colors.danger, borderRadius: radius.field },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.confirmLabel, { color: colors.onTint }]}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        </Sheet>
      ) : null}

      {editing ? (
        <SlotFormSheet
          title={t('slots.edit')}
          defaults={{
            weekday: editing.weekday,
            timeMin: editing.timeMin,
            durationMin: editing.durationMin,
            format: editing.format,
          }}
          onClose={() => setEditing(null)}
          onSubmit={(v) => {
            void updateSlot(editing, v).then(materializeSchedule);
            setEditing(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

interface SlotFormValue {
  weekday: number;
  timeMin: number;
  durationMin: Duration;
  format: LessonFormat;
}

// The editor surfaces the schedule attributes (weekday/time/duration/format). Per-slot
// `price`/`subject` overrides — supported by the model (ADR-0016 «переопределяемы») and
// the CRUD layer — are DEFERRED here: new slots inherit `student.rate` / no subject.

/** Add/edit form for one slot — weekday chips + time picker + duration + format. */
function SlotFormSheet({
  title,
  defaults,
  onClose,
  onSubmit,
}: {
  title: string;
  defaults: SlotFormValue;
  onClose: () => void;
  onSubmit: (value: SlotFormValue) => void;
}) {
  const t = useT();
  const { colors, radius } = useTheme();

  const [weekday, setWeekday] = useState(defaults.weekday);
  const [hh, setHh] = useState(() => pad2(Math.floor(defaults.timeMin / 60)));
  const [mm, setMm] = useState(() => pad2(defaults.timeMin % 60));
  const [durationMin, setDurationMin] = useState<Duration>(defaults.durationMin);
  const [format, setFormat] = useState<LessonFormat>(defaults.format);

  // Mon-first weekday order (Пн … Вс) mapped to JS getDay indices (1..6,0).
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const durationLabels = DURATIONS.map((d) => `${d} ${t('common.min')}`);
  const formatLabels: Record<LessonFormat, string> = {
    online: t('format.online'),
    inperson: t('format.inperson'),
  };

  const submit = () => onSubmit({ weekday, timeMin: clampInt(hh, 23) * 60 + clampInt(mm, 59), durationMin, format });

  return (
    <Sheet title={title} onClose={onClose}>
      <View style={styles.formBlock}>
        <Text style={[styles.formLabel, { color: colors.muted }]}>{t('slots.weekday')}</Text>
        <View style={styles.weekdayRow}>
          {weekdayOrder.map((wd) => {
            const on = wd === weekday;
            return (
              <Pressable
                key={wd}
                onPress={() => setWeekday(wd)}
                accessibilityRole="button"
                style={[
                  styles.weekdayChip,
                  { backgroundColor: on ? colors.primary : colors.stoneLight, borderRadius: radius.control },
                ]}>
                <Text style={[styles.weekdayChipText, { color: on ? colors.onTint : colors.heading }]}>
                  {t(weekdayKey(wd))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.formBlock}>
        <Text style={[styles.formLabel, { color: colors.muted }]}>{t('slots.time')}</Text>
        <View style={styles.timeInputs}>
          <TextInput
            value={hh}
            onChangeText={setHh}
            onBlur={() => setHh(pad2(clampInt(hh, 23)))}
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel={t('slots.time')}
            style={[styles.timeInput, { backgroundColor: colors.elev, color: colors.heading, borderColor: colors.hairline, borderRadius: radius.control }]}
          />
          <Text style={[styles.colon, { color: colors.heading }]}>:</Text>
          <TextInput
            value={mm}
            onChangeText={setMm}
            onBlur={() => setMm(pad2(clampInt(mm, 59)))}
            keyboardType="number-pad"
            maxLength={2}
            accessibilityLabel={t('slots.time')}
            style={[styles.timeInput, { backgroundColor: colors.elev, color: colors.heading, borderColor: colors.hairline, borderRadius: radius.control }]}
          />
        </View>
      </View>

      <View style={styles.formBlock}>
        <Text style={[styles.formLabel, { color: colors.muted }]}>{t('field.duration')}</Text>
        <Segmented
          tabs={durationLabels}
          active={`${durationMin} ${t('common.min')}`}
          onChange={(tab) => setDurationMin(parseInt(tab, 10) as Duration)}
        />
      </View>

      <View style={styles.formBlock}>
        <Text style={[styles.formLabel, { color: colors.muted }]}>{t('field.format')}</Text>
        <Segmented
          tabs={[formatLabels.online, formatLabels.inperson]}
          active={formatLabels[format]}
          onChange={(tab) => setFormat(tab === formatLabels.inperson ? 'inperson' : 'online')}
        />
      </View>

      <Pressable
        onPress={submit}
        style={({ pressed }) => [
          styles.submitBtn,
          { backgroundColor: colors.primary, borderRadius: radius.field },
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.submitLabel, { color: colors.onTint }]}>{t('common.save')}</Text>
      </Pressable>
    </Sheet>
  );
}

/** Compact stack header — back chevron + centred title. */
function Header({ title }: { title: string }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
      <Pressable
        onPress={() => backOrHome()}
        hitSlop={10}
        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}>
        <Icon name="chevronLeft" size={24} stroke={colors.heading} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.heading }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center', letterSpacing: -0.3 },

  list: { gap: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12 },
  slotMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotWeekday: { fontSize: 15, fontWeight: '700', width: 34 },
  slotTime: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], width: 52 },
  slotMeta: { fontSize: 13, fontWeight: '500', flex: 1 },
  slotClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
  addLabel: { fontSize: 14.5, fontWeight: '600' },

  formBlock: { gap: 8, marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  weekdayRow: { flexDirection: 'row', gap: 6 },
  weekdayChip: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  weekdayChipText: { fontSize: 13, fontWeight: '600' },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    width: 64,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  colon: { fontSize: 20, fontWeight: '700' },
  submitBtn: { paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitLabel: { fontSize: 16, fontWeight: '600' },

  confirmText: { fontSize: 14.5, lineHeight: 20, marginBottom: 16 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  confirmLabel: { fontSize: 15, fontWeight: '600' },

  pressed: { opacity: 0.7 },
});
