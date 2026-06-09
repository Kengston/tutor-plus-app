/**
 * Ученик/Клиент card — full read-only profile (Phase 1 composition).
 *
 * Header → identity + debt → contact / schedule actions → data block (fields) →
 * upcoming lessons → archive. All money/status is DERIVED via `domain/aggregates`
 * over the reactive ledger (ADR-0008); every label flows through `useT()` so the
 * lexicon (Ученик ⇄ Клиент) swaps at display only (ADR-0006). No stored debt/pay.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import {
  useAllTransactions,
  useStudent,
  useStudentLessons,
  useStudentSubjects,
  useStudentTransactions,
} from '@/db/hooks';
import type { LessonModel } from '@/db/models';
import { setStudentStatus } from '@/db/mutations';
import { debtOf, payStatusOf } from '@/domain/aggregates';
import type { LessonFormat, PayStatus, StudentStatus } from '@/domain/types';
import { useT, type StringKey } from '@/i18n';
import { formatRub } from '@/lib/format';
import { hhmm, nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { CatAvatar, Chip, Dot, Icon, Sheet, type DotTone } from '@/ui';

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
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');

  const student = useStudent(id);
  const subjects = useStudentSubjects(id);
  const transactions = useStudentTransactions(id);
  const lessons = useStudentLessons(id);
  const allTxns = useAllTransactions();

  const [contactOpen, setContactOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard: hooks emit undefined before the row loads (or for a bad id).
  if (!student) {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
        <Header title="" onEdit={null} />
        <EmptyState icon="users" text={t('common.none')} />
      </SafeAreaView>
    );
  }

  const debt = debtOf(transactions);
  const isArchived = student.status === 'archived';

  const now = nowMs();
  const upcoming = lessons
    .filter((l) => l.startsAt >= now && l.lifecycleStatus !== 'cancelled')
    .sort((a, b) => a.startsAt - b.startsAt);

  const openContact = () => setContactOpen(true);
  const closeContact = () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    setCopied(false);
    setContactOpen(false);
  };

  const goEdit = () => router.push({ pathname: '/student/edit/[id]', params: { id } });
  const goSchedule = () => router.push({ pathname: '/lesson/new', params: { studentId: id } });
  const openLesson = (lessonId: string) =>
    router.push({ pathname: '/lesson/[id]', params: { id: lessonId } });

  const onCall = () => {
    closeContact();
    if (student.phone) openUrl(`tel:${sanitizePhone(student.phone)}`);
  };
  const onMessage = () => {
    closeContact();
    if (student.phone) openUrl(`sms:${sanitizePhone(student.phone)}`);
  };
  const onCopy = () => {
    copyText(student.phone);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const onArchive = () => {
    if (!isArchived) void setStudentStatus(student, 'archived');
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={student.name} onEdit={goEdit} />

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

        {/* ── Primary actions ──────────────────────────────────────── */}
        <View style={styles.actions}>
          <Pressable
            onPress={openContact}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.surface, borderColor: colors.hairline },
              pressed && styles.pressed,
            ]}>
            <Icon name="phone" size={18} stroke={colors.heading} />
            <Text style={[styles.actionLabel, { color: colors.heading }]}>{t('common.contact')}</Text>
          </Pressable>
          <Pressable
            onPress={goSchedule}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionPrimary,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}>
            <Icon name="plus" size={18} stroke={colors.onTint} />
            <Text style={[styles.actionLabel, { color: colors.onTint }]}>
              {t('student.scheduleLesson')}
            </Text>
          </Pressable>
        </View>

        {/* ── Data block ───────────────────────────────────────────── */}
        <View style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          <DataRow label={t('field.subjects')} divider={false}>
            {subjects.length > 0 ? (
              <View style={styles.chips}>
                {subjects.map((s) => (
                  <Chip key={s.id}>{s.name}</Chip>
                ))}
              </View>
            ) : (
              <Text style={[styles.value, { color: colors.label3 }]}>{t('common.none')}</Text>
            )}
          </DataRow>
          <DataRow label={t('field.format')}>
            <Text style={[styles.value, { color: colors.body }]}>{t(FORMAT_KEY[student.format])}</Text>
          </DataRow>
          <DataRow label={t('lesson.rate')}>
            <Text style={[styles.value, { color: colors.body }]}>{formatRub(student.rate)}</Text>
          </DataRow>
          <DataRow label={t('field.schedule')}>
            <Text style={[styles.value, { color: colors.body }]}>
              {student.schedule || t('common.none')}
            </Text>
          </DataRow>
          <DataRow label={t('field.phone')}>
            <Text style={[styles.value, { color: colors.body }]}>
              {student.phone || t('common.none')}
            </Text>
          </DataRow>
        </View>

        {/* ── Upcoming lessons/meetings ────────────────────────────── */}
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
          <Text style={[styles.empty, { color: colors.label3 }]}>{t('student.noUpcoming')}</Text>
        )}

        {/* ── Archive ──────────────────────────────────────────────── */}
        <Pressable
          onPress={onArchive}
          disabled={isArchived}
          style={({ pressed }) => [
            styles.archiveBtn,
            { borderColor: colors.hairline },
            pressed && !isArchived && styles.pressed,
          ]}>
          <Icon name="archive" size={18} stroke={isArchived ? colors.label3 : colors.danger} />
          <Text style={[styles.archiveLabel, { color: isArchived ? colors.label3 : colors.danger }]}>
            {isArchived ? t('student.archived') : t('students.archive')}
          </Text>
        </Pressable>
      </ScrollView>

      {/* ── Contact sheet ──────────────────────────────────────────── */}
      {contactOpen ? (
        <Sheet title={t('common.contact')} onClose={closeContact}>
          <ContactAction icon="phone" label={t('contact.call')} onPress={onCall} />
          <ContactAction icon="message" label={t('contact.message')} onPress={onMessage} />
          <ContactAction
            icon="link"
            label={copied ? t('common.copied') : t('contact.copy')}
            onPress={onCopy}
          />
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

/** Compact stack header: back chevron + title + edit pencil (headerShown is false). */
function Header({ title, onEdit }: { title: string; onEdit: (() => void) | null }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
      <Pressable
        onPress={() => router.back()}
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
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.lessonRow,
        { backgroundColor: colors.surface, borderColor: colors.hairline },
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

/** A row inside the contact sheet. */
function ContactAction({
  icon,
  label,
  onPress,
}: {
  icon: 'phone' | 'message' | 'link';
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.contactRow, pressed && { backgroundColor: colors.stoneLight }]}>
      <Icon name={icon} size={20} stroke={colors.heading} />
      <Text style={[styles.contactLabel, { color: colors.heading }]}>{label}</Text>
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

/** Best-effort clipboard copy on web; no-op where unavailable (Phase 1). */
function copyText(text: string): void {
  const clip = (globalThis as { navigator?: { clipboard?: { writeText?: (s: string) => Promise<void> } } })
    .navigator?.clipboard;
  if (clip?.writeText) void clip.writeText(text).catch(() => undefined);
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
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionPrimary: { borderWidth: 0 },
  actionLabel: { fontSize: 14.5, fontWeight: '600' },

  dataCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  dataRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, gap: 12 },
  dataLabel: { width: 92, fontSize: 13.5, fontWeight: '500', paddingTop: 1 },
  dataValue: { flex: 1, alignItems: 'flex-end' },
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
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lessonTime: { fontSize: 15, fontWeight: '700', minWidth: 44, fontVariant: ['tabular-nums'] },
  lessonTopic: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  empty: { fontSize: 14, marginTop: -6 },

  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  archiveLabel: { fontSize: 14.5, fontWeight: '600' },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  contactLabel: { fontSize: 16, fontWeight: '500' },

  pressed: { opacity: 0.7 },
});
