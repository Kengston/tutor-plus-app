/**
 * Analytics · Обзор aggregates + insights (UI-v2 S11, spec 08 §8.1). Pins issue #29:
 * per-student / per-format income cuts, an arbitrary comparison delta, and the rule-based
 * «Выводы» generator (which must stay silent on thin data).
 */
import { describe, expect, it } from 'vitest';

import { monthOf } from '@/lib/period';

import { incomeByFormat, incomeByStudent, incomeInPeriod, metricDelta, overviewInsights } from './aggregates';

const APR = 3;
const MAY = 4;
const JUN = 5;
const at = (month: number, day: number, h = 12) => new Date(2026, month, day, h, 0, 0).getTime();
const may = monthOf(at(MAY, 15));
const apr = monthOf(at(APR, 15));
const jun = monthOf(at(JUN, 15));

type Over = Partial<{ id: string; studentId: string; subjectId: string | null; lessonId: string | null }>;
const paid = (amount: number, occurredAt: number, over: Over = {}) =>
  ({ id: 'p', studentId: 's1', type: 'paid' as const, amount, lessonId: null, subjectId: null, occurredAt, method: 'transfer' as const, ...over });
const debt = (amount: number, occurredAt: number, over: Over = {}) =>
  ({ id: 'd', studentId: 's1', type: 'debt' as const, amount, lessonId: null, subjectId: null, occurredAt, method: null, ...over });

describe('incomeByStudent (Ученики)', () => {
  it('sums paid per student in period, sorted desc; ignores out-of-period and non-paid', () => {
    const txns = [
      paid(1000, at(MAY, 5), { studentId: 'a' }),
      paid(2000, at(MAY, 10), { studentId: 'b' }),
      paid(500, at(MAY, 20), { studentId: 'a' }),
      paid(9999, at(APR, 10), { studentId: 'a' }), // out of period
      debt(4000, at(MAY, 12), { studentId: 'b' }), // not paid
    ];
    expect(incomeByStudent(txns, may)).toEqual([
      { studentId: 'b', amount: 2000 },
      { studentId: 'a', amount: 1500 },
    ]);
  });
});

describe('incomeByFormat (Формат)', () => {
  it('joins paid txns to their lesson format, desc; excludes standalone (no lesson)', () => {
    const lessons = [
      { id: 'l1', format: 'online' as const },
      { id: 'l2', format: 'inperson' as const },
      { id: 'l3', format: 'online' as const },
    ];
    const txns = [
      paid(1000, at(MAY, 5), { lessonId: 'l1' }), // online
      paid(2000, at(MAY, 6), { lessonId: 'l2' }), // inperson
      paid(500, at(MAY, 7), { lessonId: 'l3' }), // online
      paid(9000, at(MAY, 8), { lessonId: null }), // standalone → no format → excluded
    ];
    expect(incomeByFormat(lessons, txns, may)).toEqual([
      { format: 'inperson', amount: 2000 },
      { format: 'online', amount: 1500 },
    ]);
  });
});

describe('comparison delta (произвольный период сравнения)', () => {
  it('recomputes income Δ% for whatever comparison period is chosen', () => {
    const txns = [paid(10000, at(MAY, 5)), paid(8000, at(APR, 5)), paid(4000, at(JUN, 5))];
    expect(metricDelta(incomeInPeriod(txns, may), incomeInPeriod(txns, apr)).pct).toBe(25); // 10k vs 8k
    expect(metricDelta(incomeInPeriod(txns, may), incomeInPeriod(txns, jun)).pct).toBe(150); // 10k vs 4k
  });
});

describe('overviewInsights (Выводы)', () => {
  it('surfaces the dominant direction share and the income change vs comparison', () => {
    const txns = [
      paid(6000, at(MAY, 5), { subjectId: 'math' }),
      paid(4000, at(MAY, 6), { subjectId: 'eng' }),
      paid(5000, at(APR, 5), { subjectId: 'math' }), // April baseline = 5000
    ];
    const ins = overviewInsights(txns, may, apr); // May 10000 vs April 5000 → +100%
    expect(ins).toContainEqual({ kind: 'topDirection', subjectId: 'math', pct: 60 });
    expect(ins).toContainEqual({ kind: 'incomeDelta', pct: 100, dir: 'up' });
  });

  it('returns [] on empty data — no meaningless insight', () => {
    expect(overviewInsights([], may, apr)).toEqual([]);
  });

  it('omits the income-delta insight when the comparison baseline is zero', () => {
    const txns = [paid(6000, at(MAY, 5), { subjectId: 'math' })];
    // June has no data → baseline 0 → no % → only the dominant-direction insight remains.
    expect(overviewInsights(txns, may, jun)).toEqual([{ kind: 'topDirection', subjectId: 'math', pct: 100 }]);
  });

  it('signs a decline as dir:down', () => {
    const txns = [paid(4000, at(MAY, 5), { subjectId: 'math' }), paid(8000, at(APR, 5), { subjectId: 'math' })];
    const ins = overviewInsights(txns, may, apr); // 4000 vs 8000 → −50%
    expect(ins).toContainEqual({ kind: 'incomeDelta', pct: 50, dir: 'down' });
  });
});
