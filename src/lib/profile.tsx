/**
 * Profile hydration + reminder seam (ADR-0013, Phase 3).
 *
 * `ProfileGate` get-or-creates the single `profiles` row on launch and feeds its
 * `theme`/`clientType` as the INITIAL values of `ThemeProvider`/`DualModeProvider` —
 * closing the Phase-0 in-memory TODO (those now survive reload). Settings writes go
 * DB→context one-way (update the row AND the context setter); no observe-back, so no cycles.
 *
 * `ReminderSync` is the native scheduler seam: it (re)plans local OS reminders whenever
 * lessons/prefs change. On web `scheduler.sync` is a no-op (the in-app feed is the surface);
 * on native it drives expo-notifications (verified under OQ-F).
 */
import { useEffect, useState, type ReactNode } from 'react';

import { useAllLessons, useProfile, useStudents } from '@/db/hooks';
import { ensureProfile } from '@/db/mutations';
import type { ReminderPrefs } from '@/domain/types';
import type { ClientType } from '@/i18n';
import { useT } from '@/i18n';
import type { ThemeMode } from '@/theme';

import { hhmm, nowMs } from './time';
import { scheduler } from './notifications';
import { planReminders, type LocalReminder } from './notification-scheduler';

/** Structural slice of the reminder-relevant profile fields. */
interface ProfilePrefsLike {
  reminderLeadMin: number;
  notifLessons: boolean;
  notifPayment: boolean;
  notifSchedule: boolean;
  notifSummary: boolean;
  pushGranted: boolean;
}

/** Profile row → `ReminderPrefs` (the shape the feed builder + scheduler consume). */
export function reminderPrefsOf(p: ProfilePrefsLike): ReminderPrefs {
  return {
    leadMin: p.reminderLeadMin,
    lessons: p.notifLessons,
    payment: p.notifPayment,
    schedule: p.notifSchedule,
    summary: p.notifSummary,
    pushGranted: p.pushGranted,
  };
}

/** Fallback prefs while the profile row is loading (everything on, 1-hour lead). */
export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  leadMin: 60,
  lessons: true,
  payment: true,
  schedule: true,
  summary: true,
  pushGranted: false,
};

interface InitialProfile {
  theme: ThemeMode;
  clientType: ClientType;
}

/**
 * Block until the single profile row exists, then render children with its theme/mode as the
 * providers' initial values. A brief null splash before mount is acceptable (Phase-0 parity).
 */
export function ProfileGate({ children }: { children: (initial: InitialProfile) => ReactNode }) {
  const [initial, setInitial] = useState<InitialProfile | null>(null);

  useEffect(() => {
    let alive = true;
    ensureProfile()
      .then((p) => {
        if (alive) setInitial({ theme: p.theme, clientType: p.clientType });
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[profile] ensure failed', e);
        if (alive) setInitial({ theme: 'system', clientType: 'Ученик' });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!initial) return null;
  return <>{children(initial)}</>;
}

/**
 * Invisible seam component (mounted once): keeps OS-scheduled local reminders in sync with the
 * upcoming lessons + prefs. Web → no-op; native → expo-notifications rolling-window.
 */
export function ReminderSync() {
  const lessons = useAllLessons();
  const students = useStudents();
  const profile = useProfile();
  const t = useT();

  useEffect(() => {
    if (!profile) return;
    const prefs = reminderPrefsOf(profile);
    const planned = planReminders(lessons, prefs, nowMs());
    const nameById = new Map(students.map((s) => [s.id, s.name] as const));
    const studentByLesson = new Map(lessons.map((l) => [l.id, l.studentId] as const));
    const reminders: LocalReminder[] = planned.map((p) => {
      const studentId = studentByLesson.get(p.lessonId);
      const name = studentId ? nameById.get(studentId) : undefined;
      return {
        id: p.id,
        fireAt: p.fireAt,
        title: t('notif.reminderTitle'),
        body: name ? `${name} · ${hhmm(p.lessonAt)}` : hhmm(p.lessonAt),
      };
    });
    void scheduler.sync(reminders);
  }, [lessons, students, profile, t]);

  return null;
}
