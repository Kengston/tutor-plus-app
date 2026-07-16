/**
 * Finance summary + Expectation invariants (UI-v2 S10, ADR-0015). Pins the acceptance
 * criteria of issue #28: «Фактически получено» = Σ paid in period; creating «Ожидается»
 * writes no ledger record; an expectation settles into a paid payment + close; an overdue
 * expectation never auto-becomes debt.
 */
import { describe, expect, it } from 'vitest';

import { monthOf } from '@/lib/period';

import { debtOf, entriesInPeriod, financeEntries, periodSummary } from './aggregates';
import { openExpectations, settleExpectation } from './expectations';

// Local-time instants (May/June 2026) so period buckets are tz-robust (noon avoids DST edges).
const MAY = 4;
const JUN = 5;
const at = (month: number, day: number, h = 12) => new Date(2026, month, day, h, 0, 0).getTime();
const mayPeriod = monthOf(at(MAY, 15));
const junePeriod = monthOf(at(JUN, 15));

const paid = (id: string, amount: number, occurredAt: number, lessonId: string | null = null) =>
  ({ id, studentId: 's1', type: 'paid' as const, amount, lessonId, subjectId: null, occurredAt, method: 'transfer' as const });
const debt = (id: string, amount: number, occurredAt: number) =>
  ({ id, studentId: 's1', type: 'debt' as const, amount, lessonId: null, subjectId: null, occurredAt, method: null });
const exp = (id: string, amount: number, dueAt: number, status: 'open' | 'closed') =>
  ({ id, studentId: 's1', amount, dueAt, status });
const lesson = (id: string, price: number, startsAt: number) =>
  ({ id, studentId: 's1', subjectId: null, price, startsAt, lifecycleStatus: 'upcoming' as const });

describe('periodSummary — «Фактически получено» (spec 07 §7.1)', () => {
  it('received = Σ paid in period; changing period recomputes all three figures', () => {
    const txns = [paid('p1', 1500, at(MAY, 10)), paid('p2', 2500, at(MAY, 20)), paid('p3', 3000, at(JUN, 5))];
    const may = periodSummary(entriesInPeriod(financeEntries([], txns), mayPeriod));
    expect(may).toEqual({ received: 4000, debt: 0, expected: 0 });
    const jun = periodSummary(entriesInPeriod(financeEntries([], txns), junePeriod));
    expect(jun.received).toBe(3000);
  });

  it('«Ожидается» sums derived expected-lessons AND open expectations (ADR-0015)', () => {
    const lessons = [lesson('l1', 2000, at(MAY, 12))]; // upcoming, no linked txn → expected
    const exps = [exp('e1', 5000, at(MAY, 20), 'open')];
    const s = periodSummary(entriesInPeriod(financeEntries(lessons, [], exps), mayPeriod));
    expect(s.expected).toBe(7000);
  });
});

describe('Expectation is outside the ledger (ADR-0015)', () => {
  it('an open expectation counts as expected — never as received or debt, and adds no txn', () => {
    const txns = [paid('p1', 1500, at(MAY, 10))];
    const exps = [exp('e1', 5000, at(MAY, 20), 'open')];
    const entries = entriesInPeriod(financeEntries([], txns, exps), mayPeriod);

    expect(periodSummary(entries)).toEqual({ received: 1500, debt: 0, expected: 5000 });
    // debt derives from the transactions ledger ONLY — the expectation cannot touch it.
    expect(debtOf(txns)).toBe(0);

    const row = entries.find((e) => e.source === 'expectation');
    expect(row?.kind).toBe('expected');
    expect(row?.id).toBe('expectation:e1');
    expect(row?.lessonId).toBeNull();
  });

  it('a closed (settled) expectation drops out of «Ожидается»', () => {
    expect(financeEntries([], [], [exp('e1', 5000, at(MAY, 20), 'closed')])).toHaveLength(0);
  });

  it('an overdue open expectation stays «Ожидается» — NEVER auto-converts to debt (ADR-0009)', () => {
    const overdue = exp('e1', 5000, at(MAY, 1), 'open'); // due date in the past
    const entries = financeEntries([], [], [overdue]);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('expected');
    expect(periodSummary(entries)).toEqual({ received: 0, debt: 0, expected: 5000 });
  });

  it('a real debt txn still counts as debt (control — the ledger is unaffected by expectations)', () => {
    const entries = entriesInPeriod(financeEntries([], [debt('d1', 1500, at(MAY, 10))], [exp('e1', 5000, at(MAY, 20), 'open')]), mayPeriod);
    expect(periodSummary(entries)).toEqual({ received: 0, debt: 1500, expected: 5000 });
  });
});

describe('settleExpectation (ADR-0015)', () => {
  it('yields a paid payment carrying the participant/amount/comment, and closes the expectation', () => {
    const e = { studentId: 's1', amount: 5000, comment: 'предоплата' };
    const { payment, nextStatus } = settleExpectation(e, { method: 'cash', occurredAt: at(MAY, 22) });
    expect(payment).toEqual({ studentId: 's1', amount: 5000, method: 'cash', occurredAt: at(MAY, 22), comment: 'предоплата' });
    expect(nextStatus).toBe('closed');
  });
});

describe('openExpectations', () => {
  it('keeps only status==="open"', () => {
    const list = [exp('a', 1, 0, 'open'), exp('b', 2, 0, 'closed'), exp('c', 3, 0, 'open')];
    expect(openExpectations(list).map((x) => x.id)).toEqual(['a', 'c']);
  });
});
