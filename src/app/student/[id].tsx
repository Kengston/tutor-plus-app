/**
 * Ученик/Клиент card — full read-only profile (Phase 1 composition).
 *
 * Header → identity + debt → contact / schedule actions → data block (fields) →
 * upcoming lessons → archive. All money/status is DERIVED via `domain/aggregates`
 * over the reactive ledger (ADR-0008); every label flows through `useT()` so the
 * lexicon (Ученик ⇄ Клиент) swaps at display only (ADR-0006). No stored debt/pay.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import {
  useAllTransactions,
  useStudent,
  useStudentLessons,
  useStudentNotes,
  useStudentSlots,
  useStudentSubjects,
  useStudentTransactions,
} from '@/db/hooks';
import type { LessonModel, ScheduleSlotModel, StudentNoteModel } from '@/db/models';
import { addStudentNote, deleteStudentNote, setStudentStatus } from '@/db/mutations';
import { debtOf, payStatusOf } from '@/domain/aggregates';
import type { LessonFormat, PayStatus, StudentStatus } from '@/domain/types';
import { useT, type StringKey } from '@/i18n';
import { formatRub } from '@/lib/format';
import { backOrHome } from '@/lib/nav';
import { hhmm, nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { CatAvatar, Chip, Dot, type DotTone, Icon, PlusStroke, Sheet, Text, TextInput } from '@/ui';

/** RU date «8 июня» from a UTC-instant ms, via i18n month keys. */
function dateLabelOf(ms: number, t: (k: StringKey) => string): string {
  const d = new Date(ms);
  return `${d.getDate()} ${t(`monthGen.${d.getMonth()}` as StringKey)}`;
}

/** «16:00» from a slot's minutes-since-midnight. */
function slotTimeLabel(timeMin: number): string {
  const h = Math.floor(timeMin / 60);
  const m = timeMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Summarize active slots as «Пн, Ср · 16:00» groups (weekdays sharing a time), Mon-first. */
function summarizeSlots(slots: ScheduleSlotModel[], now: number, t: (k: StringKey) => string): string {
  const active = slots.filter((s) => s.activeTo === null || s.activeTo > now);
  if (active.length === 0) return '';
  const byTime = new Map<number, number[]>();
  for (const s of active) {
    const arr = byTime.get(s.timeMin);
    if (arr) arr.push(s.weekday);
    else byTime.set(s.timeMin, [s.weekday]);
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([timeMin, wds]) => {
      const days = order
        .filter((w) => wds.includes(w))
        .map((w) => t(`wd.${w}` as StringKey))
        .join(', ');
      return `${days} · ${slotTimeLabel(timeMin)}`;
    })
    .join('\n');
}

/** Student status → display key (typed so TS validates every member). */
const STATUS_KEY: Record<StudentStatus, StringKey> = {
  active: 'status.active',
  paused: 'status.paused',
  archived: 'status.archived',
};

/** Lesson format → display key. */
const FORMAT_KEY: Record<LessonFormat, StringKey> = {
  online: 'format.online',
  inperson: 'format.inperson',
};

/** Derived payment tri-state → Dot tone. */
const PAY_DOT: Record<PayStatus, DotTone> = {
  paid: 'green',
  debt: 'red',
  expected: 'amber',
};

export default function StudentCardScreen() {
  const t = useT();
  const { colors, radius } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');

  const student = useStudent(id);
  const subjects = useStudentSubjects(id);
  const transactions = useStudentTransactions(id);
  const lessons = useStudentLessons(id);
  const slots = useStudentSlots(id);
  const notes = useStudentNotes(id);
  const allTxns = useAllTransactions();

  const [noteDraft, setNoteDraft] = useState('');
  // Pending status change awaiting confirmation (spec 06 §6.3: «с подтверждением»).
  const [confirmStatus, setConfirmStatus] = useState<StudentStatus | null>(null);

  // Guard: hooks emit undefined before the row loads (or for a bad id).
  if (!student) {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
        <Header title={t('profile.title')} onEdit={null} />
        <EmptyState icon="users" text={t('common.none')} />
      </SafeAreaView>
    );
  }

  const debt = debtOf(transactions);
  const isArchived = student.status === 'archived';

  const now = nowMs();
  // Upcoming = still-future, not conducted/cancelled (sorted soonest first).
  const upcoming = lessons
    .filter((l) => l.startsAt >= now && l.lifecycleStatus === 'upcoming')
    .sort((a, b) => a.startsAt - b.startsAt);
  const nextLesson = upcoming[0] ?? null;
  // History = conducted OR simply in the past (a missed-but-not-yet-marked lesson must not
  // fall through the gap between the two lists); newest first (spec 06 §6.3).
  const history = lessons
    .filter((l) => l.lifecycleStatus === 'done' || (l.startsAt < now && l.lifecycleStatus !== 'cancelled'))
    .sort((a, b) => b.startsAt - a.startsAt);

  const goEdit = () => router.push({ pathname: '/student/edit/[id]', params: { id } });
  const goSlots = () => router.push({ pathname: '/student/schedule/[id]', params: { id } });
  const openLesson = (lessonId: string) =>
    router.push({ pathname: '/lesson/[id]', params: { id: lessonId } });

  const onCall = () => {
    if (student.phone) openUrl(`tel:${sanitizePhone(student.phone)}`);
  };
  const onMessage = () => {
    if (student.phone) openUrl(`sms:${sanitizePhone(student.phone)}`);
  };

  const onAddNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    void addStudentNote(id, text);
    setNoteDraft('');
  };

  const isPaused = student.status === 'paused';
  // Confirmation copy per target status.
  const confirmText = (status: StudentStatus): string =>
    status === 'paused' ? t('profile.confirmPause') : status === 'archived' ? t('profile.confirmArchive') : t('profile.confirmActivate');
  const applyStatus = () => {
    if (confirmStatus) void setStudentStatus(student, confirmStatus);
    setConfirmStatus(null);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('profile.title')} onEdit={goEdit} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Identity ─────────────────────────────────────────────── */}
        <View style={styles.identity}>
          <CatAvatar initials={student.initials} cat={student.category} size={84} />
          <Text style={[styles.name, { color: colors.heading }]}>{student.name}</Text>
          <Text style={[styles.status, { color: colors.muted }]}>{t(STATUS_KEY[student.status])}</Text>
          {debt > 0 ? (
            <Text style={[styles.debt, { color: colors.danger }]}>
              {t('finance.debt')} · {formatRub(debt)}
            </Text>
          ) : null}
        </View>

        {/* ── Primary actions: «Позвонить» (primary) + «Написать» (spec 06 §6.3) ─── */}
        <View style={styles.actions}>
          <Pressable
            onPress={onCall}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionPrimary,
              { backgroundColor: colors.heading, borderRadius: radius.field },
              pressed && styles.pressed,
            ]}>
            <Icon name="phone" size={18} stroke={colors.bg} />
            <Text style={[styles.actionLabel, { color: colors.bg }]} numberOfLines={1}>{t('contact.call')}</Text>
          </Pressable>
          <Pressable
            onPress={onMessage}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field },
              pressed && styles.pressed,
            ]}>
            <Icon name="message" size={18} stroke={colors.heading} />
            <Text style={[styles.actionLabel, { color: colors.heading }]} numberOfLines={1}>{t('contact.message')}</Text>
          </Pressable>
        </View>

        {/* ── «Следующее занятие» block (spec 06 §6.3) ─────────────────── */}
        {nextLesson ? (
          <View style={[styles.nextCard, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.group }]}>
            <Text style={[styles.nextLabel, { color: colors.muted }]}>{t('profile.next')}</Text>
            <Text style={[styles.nextWhen, { color: colors.heading }]}>
              {dateLabelOf(nextLesson.startsAt, t)} · {hhmm(nextLesson.startsAt)} · {t(FORMAT_KEY[nextLesson.format])}
            </Text>
            <Pressable
              onPress={() => openLesson(nextLesson.id)}
              style={({ pressed }) => [styles.nextBtn, { backgroundColor: colors.primaryVlight, borderRadius: radius.field }, pressed && styles.pressed]}>
              <Text style={[styles.nextBtnLabel, { color: colors.primaryDeep }]}>{t('profile.openLesson')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── «Об обучении» card (spec 06 §6.3) ────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('profile.about')}</Text>
        <View style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.group }]}>
          <DataRow label={t('field.subjects')} divider={false}>
            {subjects.length > 0 ? (
              <View style={styles.chips}>
                {subjects.map((s) => (
                  <Chip key={s.id}>{s.name}</Chip>
                ))}
              </View>
            ) : (
              <Text style={[styles.value, { color: colors.muted }]}>{t('common.none')}</Text>
            )}
          </DataRow>
          <DataRow label={t('field.format')}>
            <Text style={[styles.value, { color: colors.body }]}>{t(FORMAT_KEY[student.format])}</Text>
          </DataRow>
          <DataRow label={t('lesson.rate')}>
            <Text style={[styles.value, { color: colors.body }]}>{formatRub(student.rate)}</Text>
          </DataRow>
          {/* Schedule = editable slots (ADR-0016): show the slot summary, tap to manage. */}
          <DataRow label={t('field.schedule')}>
            <Pressable onPress={goSlots} accessibilityRole="button" accessibilityLabel={t('slots.manage')} style={styles.scheduleValue}>
              <Text style={[styles.value, { color: colors.body }]}>
                {summarizeSlots(slots, now, t) || t('common.none')}
              </Text>
              <Icon name="chevronRight" size={16} stroke={colors.stoneInactive} />
            </Pressable>
          </DataRow>
          {/* Оплаты — «Без задолженности» / «Долг N ₽» from the derived debt (ADR-0008). */}
          <DataRow label={t('profile.payments')}>
            <Text style={[styles.value, { color: debt > 0 ? colors.danger : colors.body }]}>
              {debt > 0 ? `${t('finance.debt')} ${formatRub(debt)}` : t('profile.noDebt')}
            </Text>
          </DataRow>
        </View>

        {/* ── «Заметки» (spec 06 §6.3) ──────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('profile.notes')}</Text>
        <View style={styles.noteInputRow}>
          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder={t('profile.addNote')}
            placeholderTextColor={colors.muted}
            style={[styles.noteInput, { color: colors.heading, backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.control }]}
            onSubmitEditing={onAddNote}
            returnKeyType="done"
          />
          <Pressable
            onPress={onAddNote}
            disabled={noteDraft.trim().length === 0}
            style={({ pressed }) => [styles.noteAdd, { backgroundColor: colors.primary, borderRadius: radius.control, opacity: noteDraft.trim() ? (pressed ? 0.85 : 1) : 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel={t('profile.addNote')}>
            {/* Жест «добавить» — рукописный росчерк (канон §10, слайс #75). */}
            <PlusStroke size="marker" px={20} color={colors.onTint} />
          </Pressable>
        </View>
        {notes.length > 0 ? (
          <View style={styles.notes}>
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} />
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.muted }]}>{t('profile.notesEmpty')}</Text>
        )}

        {/* ── «Следующие занятия» + «История занятий» (spec 06 §6.3) ────── */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('student.upcoming')}</Text>
        {upcoming.length > 0 ? (
          <View style={styles.upcoming}>
            {upcoming.map((lesson) => (
              <UpcomingRow
                key={lesson.id}
                lesson={lesson}
                tone={PAY_DOT[payStatusOf(lesson.id, allTxns)]}
                onPress={() => openLesson(lesson.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.muted }]}>{t('student.noUpcoming')}</Text>
        )}

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('profile.history')}</Text>
        {history.length > 0 ? (
          <View style={styles.upcoming}>
            {history.map((lesson) => (
              <UpcomingRow
                key={lesson.id}
                lesson={lesson}
                tone={PAY_DOT[payStatusOf(lesson.id, allTxns)]}
                onPress={() => openLesson(lesson.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.muted }]}>{t('profile.historyEmpty')}</Text>
        )}

        {/* ── Status management: pause/activate + archive (spec 06 §6.3) ── */}
        <View style={styles.statusRow}>
          <Pressable
            onPress={() => setConfirmStatus(isPaused ? 'active' : 'paused')}
            disabled={isArchived}
            style={({ pressed }) => [
              styles.statusBtn,
              { borderColor: colors.hairline, borderRadius: radius.field },
              pressed && !isArchived && styles.pressed,
            ]}>
            <Icon name="clock" size={17} sw={1.8} stroke={isArchived ? colors.label3 : colors.heading} />
            <Text style={[styles.statusBtnLabel, { color: isArchived ? colors.label3 : colors.heading }]} numberOfLines={1}>
              {isPaused ? t('profile.activate') : t('profile.pause')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirmStatus('archived')}
            disabled={isArchived}
            style={({ pressed }) => [
              styles.statusBtn,
              { borderColor: colors.hairline, borderRadius: radius.field },
              pressed && !isArchived && styles.pressed,
            ]}>
            <Icon name="archive" size={17} sw={1.8} stroke={isArchived ? colors.label3 : colors.danger} />
            <Text style={[styles.statusBtnLabel, { color: isArchived ? colors.label3 : colors.danger }]} numberOfLines={1}>
              {isArchived ? t('student.archived') : t('students.archive')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Status-change confirmation (spec 06 §6.3: «с подтверждением»). */}
      {confirmStatus ? (
        <Sheet title={confirmText(confirmStatus)} onClose={() => setConfirmStatus(null)}>
          <Pressable
            onPress={applyStatus}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: confirmStatus === 'archived' ? colors.danger : colors.primary, borderRadius: radius.field },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.confirmLabel, { color: colors.onTint }]}>{t('profile.confirm')}</Text>
          </Pressable>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

/** One note row: text + date (spec 06 §6.3). Long-press deletes it. */
function NoteRow({ note }: { note: StudentNoteModel }) {
  const t = useT();
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onLongPress={() => void deleteStudentNote(note)}
      accessibilityRole="button"
      accessibilityLabel={t('profile.deleteNote')}
      style={({ pressed }) => [
        styles.noteRow,
        { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.noteText, { color: colors.heading }]}>{note.text}</Text>
      <Text style={[styles.noteDate, { color: colors.muted }]}>{dateLabelOf(note.createdAt.getTime(), t)}</Text>
    </Pressable>
  );
}

/** Compact stack header: back chevron + title + edit pencil (headerShown is false). */
function Header({ title, onEdit }: { title: string; onEdit: (() => void) | null }) {
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
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={10}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.edit')}>
          <Icon name="edit" size={22} stroke={colors.heading} />
        </Pressable>
      ) : (
        <View style={styles.headerBtn} />
      )}
    </View>
  );
}

/** One labelled row in the data card. */
function DataRow({
  label,
  children,
  divider = true,
}: {
  label: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.dataRow, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline }]}>
      <Text style={[styles.dataLabel, { color: colors.muted }]}>{label}</Text>
      <View style={styles.dataValue}>{children}</View>
    </View>
  );
}

/** A small upcoming-lesson card: time · topic · derived pay dot. */
function UpcomingRow({
  lesson,
  tone,
  onPress,
}: {
  lesson: LessonModel;
  tone: DotTone;
  onPress: () => void;
}) {
  const t = useT();
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.lessonRow,
        { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.lessonTime, { color: colors.heading }]}>{hhmm(lesson.startsAt)}</Text>
      <Text style={[styles.lessonTopic, { color: colors.body }]} numberOfLines={1}>
        {lesson.topic || t('lesson.nom')}
      </Text>
      <Dot tone={tone} />
    </Pressable>
  );
}

/** Strip everything but digits and a leading + for tel:/sms: URIs. */
function sanitizePhone(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

/** Best-effort URL open (web + native); silently ignores failures. */
function openUrl(url: string): void {
  Linking.openURL(url).catch(() => undefined);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 18 },

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

  identity: { alignItems: 'center', gap: 6, paddingTop: 14 },
  name: { fontSize: 23, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' },
  status: { fontSize: 14, fontWeight: '500' },
  debt: { fontSize: 15, fontWeight: '700', marginTop: 2 },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionPrimary: { borderWidth: 0 },
  actionLabel: { fontSize: 14.5, fontWeight: '600' },

  dataCard: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  dataRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, gap: 12 },
  dataLabel: { width: 92, fontSize: 13.5, fontWeight: '500', paddingTop: 1 },
  dataValue: { flex: 1, alignItems: 'flex-end' },
  scheduleValue: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  value: { fontSize: 14.5, fontWeight: '500', textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },

  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase' },
  upcoming: { gap: 8, marginTop: -6 },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lessonTime: { fontSize: 15, fontWeight: '700', minWidth: 44, fontVariant: ['tabular-nums'] },
  lessonTopic: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  empty: { fontSize: 14, marginTop: -6 },

  statusRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusBtnLabel: { fontSize: 14, fontWeight: '600' },
  confirmBtn: { paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  confirmLabel: { fontSize: 15.5, fontWeight: '600' },

  // «Следующее занятие»
  nextCard: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  nextLabel: { fontSize: 12.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  nextWhen: { fontSize: 15.5, fontWeight: '600', letterSpacing: -0.2 },
  nextBtn: { paddingVertical: 11, alignItems: 'center', marginTop: 2 },
  nextBtnLabel: { fontSize: 14.5, fontWeight: '600' },

  // «Заметки»
  noteInputRow: { flexDirection: 'row', gap: 8, marginTop: -6 },
  noteInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  noteAdd: { width: 44, alignItems: 'center', justifyContent: 'center' },
  notes: { gap: 8 },
  noteRow: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  noteText: { fontSize: 14.5, fontWeight: '500', lineHeight: 20 },
  noteDate: { fontSize: 12, fontWeight: '500' },

  pressed: { opacity: 0.7 },
});
