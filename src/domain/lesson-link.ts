/**
 * Meeting-link support (UI-v2 S3, delta v2.1 §3.1): `link` is a URL field ON the
 * lesson (not the student). «Подключиться» (today card) and «Открыть встречу»
 * (lesson details) are visible ONLY when the lesson is online AND has a link;
 * the details row renders the link as its short host (prototype `meetHost`).
 *
 * Pure functions — no persistence/React imports, unit-tested (vitest).
 */
import type { Lesson } from './types';

/** Visibility predicate for «Подключиться»/«Открыть встречу» (spec: online AND link). */
export function canJoinOnline(lesson: Pick<Lesson, 'format' | 'link'>): boolean {
  return lesson.format === 'online' && !!lesson.link && lesson.link.trim().length > 0;
}

/** Short, human label for a meeting URL, e.g. `meet.google.com` (prototype `meetHost`).
 *  Returns `null` for unparseable values — the SCREEN falls back to the localized
 *  `link.fallback` string (domain stays lexicon-free, ADR-0003/0006). */
export function meetHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
