/**
 * Pure notification-feed layer (ADR-0013) — the sibling of `domain/aggregates`. The feed is
 * a VIEW-MODEL, never a stored table: `NotificationItem[]` is DERIVED here, client-side, from
 * lessons + the append-only ledger. The ONLY persistence is read-state (`notification_reads`):
 * `unread = item.id ∉ reads`. History of reschedules + rich «system» messages are NOT derivable
 * from current state → deferred to an event-log/sync (Phase 4, ADR-0013).
 *
 * Typed over minimal structural slices so both plain DTOs (`./types`) and WatermelonDB model
 * instances satisfy them — no persistence/React dependency here (trivially testable).
 */
import { dayBounds } from '@/lib/time';

import type {
  LifecycleStatus,
  NotificationGroup,
  NotificationItem,
  ReminderPrefs,
  TxnType,
} from './types';

// ── Structural slices ────────────────────────────────────────────────────────
type LessonSlice = {
  id: string;
  studentId: string;
  startsAt: number;
  price: number;
  lifecycleStatus: LifecycleStatus;
};
type TxnSlice = {
  id: string;
  studentId: string;
  type: TxnType;
  amount: number;
  occurredAt: number;
  lessonId: string | null;
};
type StudentSlice = { id: string; name: string; category: NotificationItem['studentCategory'] };

/** How far back derived items stay in the feed (older payments/cancellations drop off). */
const HORIZON_MS = 30 * 86_400_000;
/** Daily summary appears after this local hour (a morning «plan for today» ping). */
const SUMMARY_HOUR = 8;
const DAY_MS = 86_400_000;

export interface FeedInput {
  lessons: readonly LessonSlice[];
  transactions: readonly TxnSlice[];
  students: readonly StudentSlice[];
  prefs: ReminderPrefs;
  /** Set of read item-ids (`notification_reads`). */
  reads: ReadonlySet<string>;
  now: number;
}

/** Local day-bucket of an instant relative to `now`. */
function groupOf(time: number, todayStart: number): NotificationGroup {
  if (time >= todayStart) return 'today';
  if (time >= todayStart - DAY_MS) return 'yesterday';
  return 'earlier';
}

/** `YYYY-MM-DD` of an instant in device-local time (stable summary id per day). */
function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Build the notification feed (newest first). Each toggle in `prefs` gates its category:
 *  - `lessons`  → `reminder` for an upcoming lesson once its lead-time window is reached
 *  - `payment`  → `payment` / `debt` for ledger rows
 *  - `schedule` → `cancelled` for a cancelled lesson (anchored to its scheduled time)
 *  - `summary`  → one `daily-summary` for today after `SUMMARY_HOUR`
 */
export function buildFeed(input: FeedInput): NotificationItem[] {
  const { lessons, transactions, students, prefs, reads, now } = input;
  const { start: todayStart, end: todayEnd } = dayBounds(now);
  const horizon = now - HORIZON_MS;

  const byId = new Map<string, StudentSlice>();
  for (const s of students) byId.set(s.id, s);

  const items: NotificationItem[] = [];
  const push = (it: Omit<NotificationItem, 'unread' | 'group'>) => {
    items.push({ ...it, unread: !reads.has(it.id), group: groupOf(it.time, todayStart) });
  };

  // 1. Reminders — upcoming lesson whose lead-time window has opened (fireAt ≤ now < startsAt).
  if (prefs.lessons) {
    const leadMs = prefs.leadMin * 60_000;
    for (const l of lessons) {
      if (l.lifecycleStatus !== 'upcoming' && l.lifecycleStatus !== 'ongoing') continue;
      if (l.startsAt <= now) continue; // already started/past — Today screen owns «Сейчас»
      const fireAt = l.startsAt - leadMs;
      if (fireAt > now) continue; // reminder hasn't fired yet
      const stu = byId.get(l.studentId);
      push({
        id: `reminder:${l.id}`,
        category: 'lesson',
        kind: 'reminder',
        time: fireAt,
        ref: { kind: 'lesson', id: l.id },
        studentName: stu?.name,
        studentCategory: stu?.category,
        lessonAt: l.startsAt,
      });
    }
  }

  // 2. Payment / debt — append-only ledger rows within the horizon.
  if (prefs.payment) {
    for (const t of transactions) {
      if (t.occurredAt < horizon) continue;
      if (t.type !== 'paid' && t.type !== 'debt') continue;
      const stu = byId.get(t.studentId);
      push({
        id: `${t.type}:${t.id}`,
        category: 'payment',
        kind: t.type === 'paid' ? 'payment' : 'debt',
        time: t.occurredAt,
        ref: { kind: 'transaction', id: t.id },
        studentName: stu?.name,
        studentCategory: stu?.category,
        amount: t.amount,
      });
    }
  }

  // 3. Cancelled — schedule change we CAN derive (current cancelled state), anchored to startsAt.
  if (prefs.schedule) {
    for (const l of lessons) {
      if (l.lifecycleStatus !== 'cancelled') continue;
      if (l.startsAt < horizon) continue; // long-past cancellations aren't notification-worthy
      const stu = byId.get(l.studentId);
      push({
        id: `cancelled:${l.id}`,
        category: 'schedule',
        kind: 'cancelled',
        time: l.startsAt,
        ref: { kind: 'lesson', id: l.id },
        studentName: stu?.name,
        studentCategory: stu?.category,
        lessonAt: l.startsAt,
      });
    }
  }

  // 4. Daily summary — count of today's still-relevant lessons, after the morning hour.
  if (prefs.summary) {
    const summaryAt = todayStart + SUMMARY_HOUR * 3_600_000;
    if (now >= summaryAt) {
      let count = 0;
      for (const l of lessons) {
        if (l.startsAt >= todayStart && l.startsAt < todayEnd && l.lifecycleStatus !== 'cancelled') count += 1;
      }
      if (count > 0) {
        push({
          id: `summary:${dateKey(todayStart)}`,
          category: 'system',
          kind: 'summary',
          time: summaryAt,
          ref: { kind: 'none' },
          count,
        });
      }
    }
  }

  items.sort((a, b) => b.time - a.time);
  return items;
}

/** Count of unread items — drives the header bell dot. */
export function unreadCount(items: readonly NotificationItem[]): number {
  let n = 0;
  for (const it of items) if (it.unread) n += 1;
  return n;
}

/** All filter categories, in chip order (the screen prepends «Все»). */
export const NOTIFICATION_CATEGORIES = ['lesson', 'payment', 'schedule', 'system'] as const;
