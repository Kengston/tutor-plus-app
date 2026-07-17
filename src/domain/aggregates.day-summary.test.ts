/** Selected-day summary aggregate (UI-v2 S4): counts + «следующее в …» instant. */
import { describe, expect, it } from 'vitest';

import { daySummary } from './aggregates';

const at = (h: number) => Date.UTC(2026, 6, 13, h, 0, 0);

describe('daySummary', () => {
  it('counts total/done and picks the earliest still-active lesson as nextAt', () => {
    const s = daySummary([
      { lifecycleStatus: 'done', startsAt: at(10) },
      { lifecycleStatus: 'done', startsAt: at(12) },
      { lifecycleStatus: 'upcoming', startsAt: at(17) },
      { lifecycleStatus: 'upcoming', startsAt: at(15) },
    ]);
    expect(s).toEqual({ total: 4, done: 2, nextAt: at(15) });
  });

  it('treats ongoing lessons as the next one (prototype: first non-done)', () => {
    const s = daySummary([
      { lifecycleStatus: 'ongoing', startsAt: at(11) },
      { lifecycleStatus: 'upcoming', startsAt: at(15) },
    ]);
    expect(s.nextAt).toBe(at(11));
  });

  it('excludes cancelled lessons from every number', () => {
    const s = daySummary([
      { lifecycleStatus: 'cancelled', startsAt: at(9) },
      { lifecycleStatus: 'done', startsAt: at(10) },
    ]);
    expect(s).toEqual({ total: 1, done: 1, nextAt: null });
  });

  it('returns nextAt=null when the day is over (all done) — «день завершён»', () => {
    const s = daySummary([
      { lifecycleStatus: 'done', startsAt: at(10) },
      { lifecycleStatus: 'done', startsAt: at(12) },
    ]);
    expect(s.nextAt).toBeNull();
  });

  it('handles an empty day', () => {
    expect(daySummary([])).toEqual({ total: 0, done: 0, nextAt: null });
  });
});
