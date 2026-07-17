/**
 * Day timeline segments (UI-v2 S5, spec 05 §5.2; prototype `buildSegments`): turn a
 * day's lessons into an ordered list of `lesson` and `gap` segments, where a `gap` is
 * the free window between the end of one lesson and the start of the next. Pure —
 * no persistence/React/i18n, unit-tested (vitest). Time is UTC-instant ms (ADR-0005).
 */

/** Minimal lesson slice the timeline reasons about. */
export interface TimelineLessonSlice {
  id: string;
  startsAt: number;
  durationMin: number;
}

export type DaySegment<L extends TimelineLessonSlice> =
  | { type: 'lesson'; lesson: L }
  | { type: 'gap'; start: number; end: number; mins: number };

/** Minimum free-window length (minutes) from which a lesson can be created in one tap. */
export const BOOKABLE_GAP_MIN = 60;

/**
 * Ordered segments for one day: each lesson, with a `gap` inserted whenever the next
 * lesson starts strictly after the previous one ends. Input need not be pre-sorted;
 * segments come out in ascending start order. Overlapping/back-to-back lessons yield
 * no gap. Lessons are compared by their [startsAt, startsAt+duration) interval, so
 * only genuine idle time becomes a window.
 */
export function daySegments<L extends TimelineLessonSlice>(lessons: readonly L[]): DaySegment<L>[] {
  const sorted = lessons.slice().sort((a, b) => a.startsAt - b.startsAt);
  const segs: DaySegment<L>[] = [];
  let prevEnd = -Infinity;
  for (const lesson of sorted) {
    if (prevEnd !== -Infinity && lesson.startsAt > prevEnd) {
      segs.push({
        type: 'gap',
        start: prevEnd,
        end: lesson.startsAt,
        mins: Math.round((lesson.startsAt - prevEnd) / 60_000),
      });
    }
    segs.push({ type: 'lesson', lesson });
    // A later lesson wholly inside a longer earlier one must not shrink the frontier.
    prevEnd = Math.max(prevEnd, lesson.startsAt + lesson.durationMin * 60_000);
  }
  return segs;
}

/** Whether a gap is long enough to book a lesson in it (spec: one-tap create). */
export function isBookableGap(seg: DaySegment<TimelineLessonSlice>): boolean {
  return seg.type === 'gap' && seg.mins >= BOOKABLE_GAP_MIN;
}
