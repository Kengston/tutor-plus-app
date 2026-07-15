/**
 * Students-list derivations (UI-v2 S8) — the next-lesson lookup and the filter/sort/search
 * pipeline as PURE functions over plain view-models. No persistence/React/i18n; the screen
 * maps its reactive models into `StudentListItem`s and renders the result. Unit-tested.
 */
import type { LifecycleStatus, StudentStatus } from './types';

/** The filter chips (spec 06 §6.1): status buckets + «Есть долг» + «Есть занятия». */
export type StudentFilter = 'all' | 'active' | 'paused' | 'archived' | 'debtors' | 'hasLessons';
export type StudentSort = 'name' | 'added' | 'status' | 'debt';

/** Minimal lesson slice for the next-lesson lookup. */
export interface NextLessonSlice {
  startsAt: number;
  lifecycleStatus: LifecycleStatus;
}

/** A row's precomputed data — the screen builds these from its reactive models. */
export interface StudentListItem {
  id: string;
  name: string;
  status: StudentStatus;
  createdAt: number;
  /** Outstanding debt (derived, ADR-0008). */
  debt: number;
  /** Earliest still-upcoming lesson instant, or null when there is none. */
  nextLessonAt: number | null;
}

/** Stable order for the «Статус» sort: active → paused → archived. */
const STATUS_ORDER: Record<StudentStatus, number> = { active: 0, paused: 1, archived: 2 };

/**
 * The student's next lesson: the earliest still-active occurrence at/after `now`
 * (cancelled/done excluded). Input need not be sorted. Returns null when there is none.
 */
export function nextUpcomingAt(lessons: readonly NextLessonSlice[], now: number): number | null {
  let best: number | null = null;
  for (const l of lessons) {
    if (l.lifecycleStatus === 'cancelled' || l.lifecycleStatus === 'done') continue;
    if (l.startsAt < now) continue;
    if (best === null || l.startsAt < best) best = l.startsAt;
  }
  return best;
}

/**
 * Filter + sort + search the list (spec 06 §6.1). `hasLessons` keeps students with a next
 * lesson; `debtors` keeps students who owe money; the status buckets match `status`; «all»
 * hides the archive. Search matches the name (case-insensitive). Sorts are stable, name
 * being the tie-breaker for status/debt.
 */
export function filterSortStudents(
  items: readonly StudentListItem[],
  opts: { filter: StudentFilter; sort: StudentSort; query: string },
): StudentListItem[] {
  const needle = opts.query.trim().toLowerCase();
  const filtered = items.filter((s) => {
    switch (opts.filter) {
      case 'debtors':
        if (s.debt <= 0) return false;
        break;
      case 'hasLessons':
        if (s.nextLessonAt === null) return false;
        break;
      case 'all':
        if (s.status === 'archived') return false;
        break;
      case 'active':
      case 'paused':
      case 'archived':
        if (s.status !== opts.filter) return false;
        break;
    }
    if (needle && !s.name.toLowerCase().includes(needle)) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (opts.sort) {
      case 'added':
        return b.createdAt - a.createdAt;
      case 'status':
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'ru');
      case 'debt':
        return b.debt - a.debt || a.name.localeCompare(b.name, 'ru');
      case 'name':
      default:
        return a.name.localeCompare(b.name, 'ru');
    }
  });
}
