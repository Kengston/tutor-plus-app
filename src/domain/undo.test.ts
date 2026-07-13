/**
 * Undo domain logic (UI-v2 S1): lifecycle snapshots, compensating records and the
 * effective-ledger filter — external behaviour incl. how the EXISTING aggregates
 * (payStatusOf/debtOf/incomeInPeriod) read a ledger after an undo.
 */
import { describe, expect, it } from 'vitest';

import { debtOf, incomeInPeriod, payStatusOf } from './aggregates';
import { lifecycleSnapshot, reversalOf, withoutReversals } from './undo';

/** Ledger-row stub — the structural slice undo/aggregates care about. */
function txn(over: Partial<TestTxn> & Pick<TestTxn, 'id' | 'type'>): TestTxn {
  return {
    studentId: 's1',
    lessonId: null,
    subjectId: null,
    amount: 1500,
    method: null,
    occurredAt: 1_000,
    reversesId: null,
    ...over,
  };
}
interface TestTxn {
  id: string;
  studentId: string;
  lessonId: string | null;
  subjectId: string | null;
  amount: number;
  type: 'paid' | 'debt' | 'expected';
  method: 'transfer' | 'cash' | 'card' | null;
  occurredAt: number;
  reversesId: string | null;
}

describe('lifecycleSnapshot', () => {
  it('captures exactly the fields a lifecycle action may touch', () => {
    const snap = lifecycleSnapshot({ lifecycleStatus: 'upcoming', cancelReason: null, comment: 'note' });
    expect(snap).toEqual({ lifecycleStatus: 'upcoming', cancelReason: null, comment: 'note' });
  });
});

describe('reversalOf', () => {
  it('mirrors the original row and links it via reversesId (append-only: no mutation)', () => {
    const original = txn({ id: 't1', type: 'paid', lessonId: 'l1', subjectId: 'sub1', amount: 2000, method: 'card' });
    const rev = reversalOf(original);
    expect(rev).toEqual({
      studentId: 's1',
      lessonId: 'l1',
      subjectId: 'sub1',
      amount: 2000,
      type: 'paid',
      method: 'card',
      reversesId: 't1',
    });
    // The original row is untouched — undo APPENDS, never edits (ADR-0002).
    expect(original.reversesId).toBeNull();
  });

  it('refuses to reverse a reversal (redo = repeat the original action)', () => {
    const rev = txn({ id: 't2', type: 'paid', reversesId: 't1' });
    expect(() => reversalOf(rev)).toThrow();
  });
});

describe('withoutReversals', () => {
  it('drops the reversal pair and keeps unrelated rows', () => {
    const rows = [
      txn({ id: 't1', type: 'paid', lessonId: 'l1' }),
      txn({ id: 't2', type: 'paid', reversesId: 't1', lessonId: 'l1' }),
      txn({ id: 't3', type: 'debt', lessonId: 'l2' }),
    ];
    expect(withoutReversals(rows).map((t) => t.id)).toEqual(['t3']);
  });

  it('does not mutate its input (the stored history keeps both rows)', () => {
    const rows = [txn({ id: 't1', type: 'paid' }), txn({ id: 't2', type: 'paid', reversesId: 't1' })];
    withoutReversals(rows);
    expect(rows).toHaveLength(2);
  });

  it('drops a dangling reversal row even when its target is absent from the slice', () => {
    const rows = [txn({ id: 't2', type: 'paid', reversesId: 'gone' }), txn({ id: 't3', type: 'debt' })];
    expect(withoutReversals(rows).map((t) => t.id)).toEqual(['t3']);
  });
});

describe('undo through the aggregates (effective ledger)', () => {
  it('payment undo returns the lesson to «expected» — payStatusOf over the effective ledger', () => {
    const paid = txn({ id: 't1', type: 'paid', lessonId: 'l1' });
    const ledger = [paid, { ...reversalOf(paid), id: 't2', occurredAt: 2_000 }];
    expect(payStatusOf('l1', ledger)).toBe('paid'); // raw history still reads paid…
    expect(payStatusOf('l1', withoutReversals(ledger))).toBe('expected'); // …effective view does not
  });

  it('debt undo zeroes the student debt', () => {
    const debt = txn({ id: 't1', type: 'debt', lessonId: 'l1', amount: 1500 });
    const ledger = [debt, { ...reversalOf(debt), id: 't2', occurredAt: 2_000 }];
    expect(debtOf(withoutReversals(ledger))).toBe(0);
  });

  it('payment undo removes the pair from income', () => {
    const paid = txn({ id: 't1', type: 'paid', amount: 2500, occurredAt: 1_000 });
    const other = txn({ id: 't3', type: 'paid', amount: 1000, occurredAt: 1_500 });
    const ledger = [paid, other, { ...reversalOf(paid), id: 't2', occurredAt: 2_000 }];
    const period = { type: 'custom', start: 0, end: 10_000 } as const;
    expect(incomeInPeriod(withoutReversals(ledger), period)).toBe(1000);
  });
});
