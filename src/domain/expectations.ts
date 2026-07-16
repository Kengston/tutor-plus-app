/**
 * Expectations (ADR-0015) — money promised WITHOUT a lesson, kept OUTSIDE the append-only
 * ledger. Pure helpers over the `Expectation` entity: which ones still surface as «Ожидается»
 * and how one is settled. The Finance list/summary fold OPEN expectations in via
 * `aggregates.financeEntries`/`periodSummary`; this module owns the settle rule.
 *
 * Invariants this module guards (unit-tested):
 *  - Creating an expectation is NOT a ledger write — an expectation is not a `Transaction`,
 *    so it never enters `received`/`debt` (the caller writes it to its own table).
 *  - Settling APPENDS a real `paid` payment AND marks the expectation `closed`; the ledger
 *    stays append-only (ADR-0002), the expectation flips (mutability is fine — not a ledger row).
 *  - An overdue open expectation is NEVER auto-converted to debt — debt is always explicit
 *    (ADR-0009); there is deliberately no time-based transition here.
 */
import type { Expectation, ExpectationStatus, PayMethod } from './types';

/** Structural slice — model instances & DTOs both satisfy it (mirrors aggregates' slices). */
type ExpectationSlice = Pick<Expectation, 'status'>;

/** Only OPEN expectations are still «Ожидается»; closed ones are settled (their `paid` txn shows). */
export function openExpectations<T extends ExpectationSlice>(expectations: readonly T[]): T[] {
  return expectations.filter((x) => x.status === 'open');
}

/** The `paid` payment appended when an expectation is settled — a standalone (no-lesson) income row. */
export interface ExpectationPayment {
  studentId: string;
  amount: number;
  method: PayMethod;
  /** UTC-instant ms of the payment. */
  occurredAt: number;
  comment: string | null;
}

/**
 * Settle an expectation (ADR-0015): the `paid` payment to APPEND to the ledger + the status
 * the expectation flips to (`closed`). Pure — the mutation layer persists both halves in one
 * writer. The payment carries the expectation's participant/amount/comment (no lesson link).
 */
export function settleExpectation(
  expectation: Pick<Expectation, 'studentId' | 'amount' | 'comment'>,
  pay: { method: PayMethod; occurredAt: number },
): { payment: ExpectationPayment; nextStatus: ExpectationStatus } {
  return {
    payment: {
      studentId: expectation.studentId,
      amount: expectation.amount,
      method: pay.method,
      occurredAt: pay.occurredAt,
      comment: expectation.comment,
    },
    nextStatus: 'closed',
  };
}
