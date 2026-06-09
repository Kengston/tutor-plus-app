/**
 * Pure derived-value layer (ADR-0008). The SINGLE source of truth for money is the
 * append-only `transactions` ledger; `Student.debt` and `Lesson.payStatus` are never
 * stored — they are COMPUTED here, client-side, offline-first.
 *
 * Functions are typed over minimal structural slices so both plain DTOs (`./types`)
 * and WatermelonDB model instances satisfy them — keeping this module free of any
 * persistence/React dependency, hence trivially testable and portable (heavy/period
 * aggregates may move server-side in Phase 4, same contract).
 *
 * ⚠ Phase 1 scope: there is NO debt-settlement flow (Finance UI is Phase 2), so every
 * transaction is a one-time, lesson-linked paid/debt at mark-done and debt only grows.
 * The naive `Σ(type='debt')` rule is therefore correct here. Netting (`Σdebt − Σpaid`),
 * prepayment/credit, packages and FIFO allocation land in Phase 2 — see TODOs.
 */
import type { LifecycleStatus, PayStatus, TxnType } from './types';

type TxnSlice = { type: TxnType; amount: number; lessonId: string | null };
type LessonSlice = { lifecycleStatus: LifecycleStatus };

/**
 * Outstanding debt of a student = Σ amount of `debt`-type transactions.
 * TODO(Phase 2): net against payments — `max(0, Σdebt − Σpaid)` — once settlement exists.
 */
export function debtOf(transactions: readonly Pick<TxnSlice, 'type' | 'amount'>[]): number {
  let total = 0;
  for (const t of transactions) if (t.type === 'debt') total += t.amount;
  return total;
}

/**
 * Payment status of a lesson, derived from its DIRECTLY-linked transactions:
 * any linked `paid` → 'paid'; else any linked `debt` → 'debt'; else 'expected'
 * (future or not-yet-recorded).
 * TODO(Phase 2): allocate unlinked prepayment/packages to lessons.
 */
export function payStatusOf(
  lessonId: string,
  transactions: readonly Pick<TxnSlice, 'type' | 'lessonId'>[],
): PayStatus {
  let hasDebt = false;
  for (const t of transactions) {
    if (t.lessonId !== lessonId) continue;
    if (t.type === 'paid') return 'paid';
    if (t.type === 'debt') hasDebt = true;
  }
  return hasDebt ? 'debt' : 'expected';
}

/** «проведено N из M» — lifecycle aggregate (NOT payment) over a set of lessons. */
export function doneOfTotal(lessons: readonly LessonSlice[]): { done: number; total: number } {
  let done = 0;
  for (const l of lessons) if (l.lifecycleStatus === 'done') done += 1;
  return { done, total: lessons.length };
}

/** Whether a student currently owes money (drives the «Есть долг» filter & card badge). */
export function hasDebt(transactions: readonly Pick<TxnSlice, 'type' | 'amount'>[]): boolean {
  return debtOf(transactions) > 0;
}
