/**
 * Analytics · Задолженности domain (UI-v2 S13, spec 08 §8.3). Pins issue #31: unsettled-debt
 * positions with origin instants, aging buckets (15 days → «Больше 14»), and the point-in-time
 * debt for the «к предыдущему периоду» delta.
 */
import { describe, expect, it } from 'vitest';

import { debtAgingBuckets, debtAsOf, debtOf, debtors, unsettledDebts } from './aggregates';

const DAY = 86_400_000;
const NOW = new Date(2026, 6, 16, 12).getTime();
const daysAgo = (n: number) => NOW - n * DAY;

type Over = Partial<{ studentId: string; lessonId: string | null }>;
const debt = (amount: number, occurredAt: number, over: Over = {}) =>
  ({ studentId: 's1', type: 'debt' as const, amount, lessonId: null, occurredAt, ...over });
const paid = (amount: number, occurredAt: number, over: Over = {}) =>
  ({ studentId: 's1', type: 'paid' as const, amount, lessonId: null, occurredAt, ...over });

describe('unsettledDebts', () => {
  it('keeps lesson-anchored debts until their lesson has a paid txn', () => {
    const txns = [
      debt(1500, daysAgo(3), { lessonId: 'l1' }),
      debt(2000, daysAgo(5), { lessonId: 'l2' }),
      paid(2000, daysAgo(1), { lessonId: 'l2' }), // settles l2
    ];
    expect(unsettledDebts(txns)).toEqual([{ studentId: 's1', amount: 1500, occurredAt: daysAgo(3) }]);
  });

  it('offsets standalone debts FIFO — payments consume the OLDEST first, remainder on the newest', () => {
    const txns = [
      debt(700, daysAgo(20)),
      debt(800, daysAgo(2)),
      paid(1000, daysAgo(1)), // covers 700 fully + 300 of the newer debt
    ];
    expect(unsettledDebts(txns)).toEqual([{ studentId: 's1', amount: 500, occurredAt: daysAgo(2) }]);
  });

  it('sums to debtOf by construction (single student)', () => {
    const txns = [
      debt(1500, daysAgo(16), { lessonId: 'l1' }),
      debt(700, daysAgo(20)),
      debt(800, daysAgo(2)),
      paid(1000, daysAgo(1)),
    ];
    const total = unsettledDebts(txns).reduce((s, d) => s + d.amount, 0);
    expect(total).toBe(debtOf(txns));
  });

  it('nets PER STUDENT — one student\'s standalone income never cancels another\'s debt (review fix S13)', () => {
    const txns = [
      paid(5000, daysAgo(1), { studentId: 'a' }), // A's standalone income (surplus)
      debt(1000, daysAgo(20), { studentId: 'b' }), // B's old standalone debt
    ];
    expect(unsettledDebts(txns)).toEqual([{ studentId: 'b', amount: 1000, occurredAt: daysAgo(20) }]);
    // Σ positions == Σ debtors (the tab's canonical per-student total), NOT the pooled clamp
    const sum = unsettledDebts(txns).reduce((s, d) => s + d.amount, 0);
    expect(sum).toBe(debtors(txns).reduce((s, d) => s + d.amount, 0));
  });

  it('FIFO stays inside the student — A\'s payment must not consume B\'s older debt', () => {
    const txns = [
      debt(1000, daysAgo(2), { studentId: 'a' }),
      paid(1000, daysAgo(1), { studentId: 'a' }), // settles A's own debt
      debt(700, daysAgo(20), { studentId: 'b' }), // B's older debt stays open
    ];
    expect(unsettledDebts(txns)).toEqual([{ studentId: 'b', amount: 700, occurredAt: daysAgo(20) }]);
  });
});

describe('debtAgingBuckets («По сроку»)', () => {
  it('classifies by whole-day age: ≤7 fresh · 8–14 d14 · >14 over14 (a 15-day debt → «Больше 14»)', () => {
    const entries = [
      { amount: 1000, occurredAt: daysAgo(3) }, // fresh
      { amount: 2000, occurredAt: daysAgo(7) }, // fresh (boundary — exactly grace)
      { amount: 1500, occurredAt: daysAgo(10) }, // d14
      { amount: 500, occurredAt: daysAgo(14) }, // d14 (boundary)
      { amount: 3000, occurredAt: daysAgo(15) }, // over14 — the acceptance criterion
    ];
    expect(debtAgingBuckets(entries, NOW)).toEqual({
      fresh: { amount: 3000, count: 2 },
      d14: { amount: 2000, count: 2 },
      over14: { amount: 3000, count: 1 },
    });
  });

  it('handles empty input', () => {
    expect(debtAgingBuckets([], NOW)).toEqual({
      fresh: { amount: 0, count: 0 },
      d14: { amount: 0, count: 0 },
      over14: { amount: 0, count: 0 },
    });
  });
});

describe('«Ожидают оплаты» — заголовок сходится с разбивкой (TP-FIX-0719, п. 1)', () => {
  // Acceptance criterion of the report: header = «Ещё не просрочено» + «до 14 дней» +
  // «Больше 14» = Σ «Требуют внимания». All three read the SAME per-student netting.
  it('заголовок == Σ бакетов «По сроку» == Σ строк списка должников', () => {
    const txns = [
      debt(6000, daysAgo(20), { studentId: 'igor', lessonId: 'l1' }), // over14, still open
      debt(1500, daysAgo(9), { studentId: 'maria', lessonId: 'l2' }),
      paid(1500, daysAgo(1), { studentId: 'maria', lessonId: 'l2' }), // settles l2 → drops out
      debt(900, daysAgo(2), { studentId: 'maria' }), // fresh standalone
    ];
    const header = debtors(txns).reduce((s, d) => s + d.amount, 0);
    const aging = debtAgingBuckets(unsettledDebts(txns), NOW);

    expect(header).toBe(6900);
    expect(aging.fresh.amount + aging.d14.amount + aging.over14.amount).toBe(header);
    expect(debtors(txns)).toEqual([
      { studentId: 'igor', amount: 6000 },
      { studentId: 'maria', amount: 900 },
    ]);
  });

  it('«ожидается» (pending) НЕ считается задолженностью — это отдельная сущность (ADR-0015)', () => {
    const txns = [
      debt(6000, daysAgo(20), { studentId: 'igor', lessonId: 'l1' }),
      { studentId: 'maria', type: 'expected' as const, amount: 548, lessonId: null, occurredAt: daysAgo(4) },
    ];
    expect(debtors(txns).reduce((s, d) => s + d.amount, 0)).toBe(6000);
    expect(unsettledDebts(txns).reduce((s, d) => s + d.amount, 0)).toBe(6000);
  });
});

describe('debtAsOf (дельта «к предыдущему периоду»)', () => {
  it('replays the ledger only up to the instant — later txns invisible', () => {
    const txns = [
      debt(1500, daysAgo(20), { lessonId: 'l1' }),
      paid(1500, daysAgo(2), { lessonId: 'l1' }), // settled AFTER the as-of point
      debt(800, daysAgo(1)),
    ];
    expect(debtAsOf(txns, daysAgo(10))).toBe(1500); // only the old debt existed then
    expect(debtOf(txns)).toBe(800); // now: l1 settled, standalone remains
  });

  it('clamps PER STUDENT like the hero total — no spurious delta when nothing happened (review fix S13)', () => {
    const txns = [
      paid(5000, daysAgo(30), { studentId: 'a' }), // A's surplus, long before the period
      debt(1000, daysAgo(25), { studentId: 'b' }), // B's old debt, long before the period
    ];
    const debtNow = debtors(txns).reduce((s, d) => s + d.amount, 0); // 1000
    expect(debtAsOf(txns, daysAgo(10))).toBe(debtNow); // same basis → delta 0, no spurious badge
  });
});
