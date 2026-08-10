/** Series scope operations (UI-v2 S7): watershed + protection invariants. */
import { describe, expect, it } from 'vitest';

import { scopeAffectedLessons, seriesLessonsFrom, type ScopeLessonSlice } from './scope';

const day = (offset: number) => new Date(2026, 6, 13 + offset).getTime();
const TODAY = day(0);

/** Sibling lesson stub for slot `s1` on day `offset`. */
function les(id: string, offset: number, over: Partial<ScopeLessonSlice> = {}): ScopeLessonSlice {
  return { id, slotId: 's1', slotDate: day(offset), lifecycleStatus: 'upcoming', modified: false, ...over };
}

const NONE = new Set<string>();

describe('seriesLessonsFrom', () => {
  const siblings = [les('a', -7), les('b', 0), les('c', 7), les('d', 14)];

  it('affects only occurrences on/after the watershed', () => {
    expect(seriesLessonsFrom(siblings, 's1', TODAY, NONE)).toEqual(['b', 'c', 'd']);
    expect(seriesLessonsFrom(siblings, 's1', day(7), NONE)).toEqual(['c', 'd']);
  });

  it('never touches conducted / cancelled / money-carrying occurrences', () => {
    const list = [
      les('done', 7, { lifecycleStatus: 'done' }),
      les('cancelled', 7, { lifecycleStatus: 'cancelled' }),
      les('paid', 7),
      les('plain', 7),
    ];
    expect(seriesLessonsFrom(list, 's1', TODAY, new Set(['paid']))).toEqual(['plain']);
  });

  it('ignores lessons of other slots', () => {
    const mixed = [les('a', 0), les('other', 0, { slotId: 's2' })];
    expect(seriesLessonsFrom(mixed, 's1', TODAY, NONE)).toEqual(['a']);
  });
});

describe('scopeAffectedLessons', () => {
  const siblings = [les('past', -7), les('anchor', 0), les('next', 7), les('later', 14)];

  it('«one» affects just the anchor', () => {
    const out = scopeAffectedLessons({ anchor: les('anchor', 0), siblings, scope: 'one', today: TODAY, protectedIds: NONE });
    expect(out).toEqual(['anchor']);
  });

  it('«following» affects the anchor and every later occurrence, not the past', () => {
    const out = scopeAffectedLessons({ anchor: les('anchor', 0), siblings, scope: 'following', today: TODAY, protectedIds: NONE });
    expect(out).toEqual(['anchor', 'next', 'later']);
    expect(out).not.toContain('past');
  });

  it('«all» affects the whole remaining series from today, skipping protected', () => {
    const list = [les('past', -7), les('doneToday', 0, { lifecycleStatus: 'done' }), les('anchor', 7), les('later', 14)];
    const out = scopeAffectedLessons({ anchor: les('anchor', 7), siblings: list, scope: 'all', today: TODAY, protectedIds: NONE });
    // From today: doneToday is protected (skipped), anchor + later remain.
    expect(out).toEqual(['anchor', 'later']);
  });

  it('a standalone (non-series) anchor is cancellable only as «one»', () => {
    const standalone: ScopeLessonSlice = { id: 'x', slotId: null, slotDate: null, lifecycleStatus: 'upcoming', modified: false };
    expect(scopeAffectedLessons({ anchor: standalone, siblings: [], scope: 'one', today: TODAY, protectedIds: NONE })).toEqual(['x']);
  });

  it('«all» never touches a past-but-still-upcoming anchor (past is inviolable)', () => {
    // Anchor is a missed occurrence in the past (day -3), still «upcoming»; «all» watershed
    // is today, so the anchor must be excluded — only future occurrences are affected.
    const list = [les('pastAnchor', -3), les('future', 7)];
    const out = scopeAffectedLessons({ anchor: les('pastAnchor', -3), siblings: list, scope: 'all', today: TODAY, protectedIds: NONE });
    expect(out).toEqual(['future']);
    expect(out).not.toContain('pastAnchor');
  });

  it('«following» from a past anchor still starts at the anchor day (that is its watershed)', () => {
    const list = [les('pastAnchor', -3), les('future', 7)];
    const out = scopeAffectedLessons({ anchor: les('pastAnchor', -3), siblings: list, scope: 'following', today: TODAY, protectedIds: NONE });
    expect(out).toEqual(['pastAnchor', 'future']);
  });

  it('«one» on a protected anchor yields nothing (money/history stays intact)', () => {
    const out = scopeAffectedLessons({ anchor: les('anchor', 0), siblings, scope: 'one', today: TODAY, protectedIds: new Set(['anchor']) });
    expect(out).toEqual([]);
  });

  it('a protected anchor blocks only ITSELF — following/all still affect free siblings', () => {
    // A paid-for occurrence must not make the whole remaining series uncancellable: the
    // pre-fix behaviour returned [] here, so a series with money on today's lesson could
    // never be cancelled from it (the review's M3 over-blocking).
    const out = scopeAffectedLessons({ anchor: les('anchor', 0), siblings, scope: 'following', today: TODAY, protectedIds: new Set(['anchor']) });
    expect(out).toEqual(['next', 'later']);
    expect(out).not.toContain('anchor');
  });

  it('always includes the anchor in following/all even if siblings are protected', () => {
    const list = [les('anchor', 0), les('next', 7, { lifecycleStatus: 'done' })];
    const out = scopeAffectedLessons({ anchor: les('anchor', 0), siblings: list, scope: 'following', today: TODAY, protectedIds: NONE });
    expect(out).toEqual(['anchor']);
  });

  it('a manually edited (`modified`) sibling is detached — series edits skip it (ADR-0016 §6)', () => {
    const list = [les('anchor', 0), les('moved', 7, { modified: true }), les('later', 14)];
    const out = scopeAffectedLessons({ anchor: les('anchor', 0), siblings: list, scope: 'all', today: TODAY, protectedIds: NONE });
    expect(out).toEqual(['anchor', 'later']);
    expect(out).not.toContain('moved');
  });

  it('a modified ANCHOR is still included — the user explicitly chose it', () => {
    const list = [les('anchor', 0, { modified: true }), les('later', 7)];
    const out = scopeAffectedLessons({ anchor: les('anchor', 0, { modified: true }), siblings: list, scope: 'following', today: TODAY, protectedIds: NONE });
    expect(out).toEqual(['anchor', 'later']);
  });
});
