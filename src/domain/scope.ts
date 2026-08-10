/**
 * Series scope operations (UI-v2 S7, ADR-0016 §3–4): which lessons a scope-cancel or
 * scope-reschedule affects, honoring the two hard invariants — the PAST is untouched
 * (only occurrences on/after the watershed day are affected) and PROTECTED occurrences
 * (conducted, already cancelled, or carrying a money operation) are never modified.
 * Pure — no persistence/React/i18n, unit-tested (vitest).
 */
import type { LifecycleStatus } from './types';

/** The three scope choices offered by the ScopeSheet. */
export type Scope = 'one' | 'following' | 'all';

/** Minimal lesson slice the scope logic reasons about. */
export interface ScopeLessonSlice {
  id: string;
  slotId: string | null;
  /** Local-midnight ms of the occurrence (the watershed axis). */
  slotDate: number | null;
  lifecycleStatus: LifecycleStatus;
  /** Manually edited occurrence — detached from series-wide edits (ADR-0016 §6). */
  modified: boolean;
}

/**
 * A lesson is PROTECTED from scope edits when it is conducted or already cancelled, or
 * when it carries a money operation (`protectedIds`) — money and history stay intact
 * (ADR-0008/0009). Standalone «Проведено» from the prototype «включая прошедшие» is out
 * of scope for #25 (cancel never touches the past).
 */
function isProtected(l: ScopeLessonSlice, protectedIds: ReadonlySet<string>): boolean {
  return l.lifecycleStatus === 'done' || l.lifecycleStatus === 'cancelled' || protectedIds.has(l.id);
}

/**
 * Ids of a slot's sibling lessons to affect for a scope operation whose watershed is
 * `fromDate` (local-midnight ms): every non-protected occurrence of the SAME slot on or
 * after `fromDate`. Callers map the scope to a watershed — `following` → the anchor's
 * day, `all` → today — and handle `one` separately (just the anchor). Deterministic;
 * order follows `siblings`.
 */
export function seriesLessonsFrom(
  siblings: readonly ScopeLessonSlice[],
  slotId: string,
  fromDate: number,
  protectedIds: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const l of siblings) {
    if (l.slotId !== slotId) continue;
    if (l.slotDate == null || l.slotDate < fromDate) continue;
    if (isProtected(l, protectedIds)) continue;
    // A manually edited occurrence is detached — the slot no longer overwrites it
    // (ADR-0016 §6). The anchor itself may still be force-included by the caller:
    // the user explicitly chose it, so their intent overrides the detachment.
    if (l.modified) continue;
    out.push(l.id);
  }
  return out;
}

/**
 * The full set of lesson ids a scope op affects, given the anchor lesson. `one` → just the
 * anchor (when not protected). `following` → the anchor's day forward. `all` → `today`
 * forward (the whole remaining series). A PROTECTED anchor blocks only itself — its free
 * future siblings are still affected by following/all (a paid-for occurrence must not make
 * the whole series uncancellable); `one` on a protected anchor returns [].
 */
export function scopeAffectedLessons(params: {
  anchor: ScopeLessonSlice;
  siblings: readonly ScopeLessonSlice[];
  scope: Scope;
  today: number;
  protectedIds: ReadonlySet<string>;
}): string[] {
  const { anchor, siblings, scope, today, protectedIds } = params;
  const anchorProtected = isProtected(anchor, protectedIds);
  if (scope === 'one' || anchor.slotId == null) {
    // Single-occurrence edit (or a standalone lesson, where only «one» is meaningful):
    // acts iff the anchor itself is untouched by money/history.
    return anchorProtected ? [] : [anchor.id];
  }
  const fromDate = scope === 'all' ? today : (anchor.slotDate ?? today);
  const ids = seriesLessonsFrom(siblings, anchor.slotId, fromDate, protectedIds);
  // Force-include the anchor ONLY when it is unprotected and its own day is on/after the
  // watershed — for «all» (watershed = today) a past-but-still-«upcoming» anchor must stay
  // untouched (the past is inviolable, ADR-0016 §4). This also re-admits a `modified`
  // anchor that `seriesLessonsFrom` skipped: the user explicitly chose it.
  const anchorInWindow = anchor.slotDate != null && anchor.slotDate >= fromDate;
  if (!anchorProtected && anchorInWindow && !ids.includes(anchor.id)) return [anchor.id, ...ids];
  return ids;
}
