/**
 * Scheduler contract + pure planner shared by both platform impls (ADR-0013), the way
 * `db/schema` is shared by `db/index.{ts,web.ts}`. The IMPL is platform-split:
 * `notifications.ts` (native, expo-notifications) / `notifications.web.ts` (Web Notifications).
 * This file is platform-agnostic and i18n-free — titles are composed by the caller.
 */
import type { LifecycleStatus, ReminderPrefs } from '@/domain/types';

/** One OS-level local reminder to schedule — fully composed by the caller (lib stays i18n-free). */
export interface LocalReminder {
  /** Stable id (mirrors the feed item: `reminder:<lessonId>`) — lets the OS replace, not duplicate. */
  id: string;
  /** When the OS should fire it (UTC-instant ms). */
  fireAt: number;
  title: string;
  body: string;
}

/** Platform scheduler contract — `notifications.ts` (native) / `notifications.web.ts` (web). */
export interface NotificationScheduler {
  /** Current OS permission (granted?). */
  getPermission(): Promise<boolean>;
  /** Prompt for OS permission; resolves to whether it was granted. */
  requestPermission(): Promise<boolean>;
  /** Replace the scheduled set with `reminders` (rolling-window). Web: no-op — the in-app feed is the surface. */
  sync(reminders: readonly LocalReminder[]): Promise<void>;
}

type LessonSlice = { id: string; startsAt: number; lifecycleStatus: LifecycleStatus };

/** iOS caps pending local notifications at 64 → schedule only the nearest N (ADR-0005 §3). */
export const ROLLING_WINDOW = 60;

export interface PlannedReminder {
  id: string;
  fireAt: number;
  lessonId: string;
  lessonAt: number;
}

/**
 * Pure plan of FUTURE local reminders to schedule (rolling-window): upcoming lessons whose
 * lead-time fire moment is still ahead, nearest `ROLLING_WINDOW` first. Already-fired reminders
 * are surfaced by the in-app feed (`domain/notifications`), not the OS — so they're excluded here.
 */
export function planReminders(
  lessons: readonly LessonSlice[],
  prefs: Pick<ReminderPrefs, 'leadMin' | 'lessons'>,
  now: number,
): PlannedReminder[] {
  if (!prefs.lessons) return [];
  const leadMs = prefs.leadMin * 60_000;
  const out: PlannedReminder[] = [];
  for (const l of lessons) {
    if (l.lifecycleStatus !== 'upcoming') continue;
    const fireAt = l.startsAt - leadMs;
    if (fireAt <= now) continue; // already fired — covered by the in-app feed
    out.push({ id: `reminder:${l.id}`, fireAt, lessonId: l.id, lessonAt: l.startsAt });
  }
  out.sort((a, b) => a.fireAt - b.fireAt);
  return out.slice(0, ROLLING_WINDOW);
}
