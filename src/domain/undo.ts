/**
 * Undo layer over domain mutations (spec v2.1 «Вернуть», 00-design-system §confirmations).
 *
 * Two undo shapes, per the two mutation families:
 *  - LIFECYCLE («Готово»/«Отменить») — undone by a REVERSE mutation: capture a snapshot
 *    of the lesson's lifecycle fields BEFORE the action, restore it on undo.
 *  - MONEY — the ledger is APPEND-ONLY (ADR-0002/0008): undo never deletes/edits the
 *    original row; it appends a COMPENSATING row linked via `reversesId`. A reversal
 *    pair (original + its reversal) is then excluded from every derived value and view
 *    by `withoutReversals` at the data boundary (db/hooks) — aggregates stay untouched.
 *
 * Pure functions only — no persistence/React imports, trivially unit-testable (vitest).
 */
import type { Lesson, LifecycleStatus, Transaction } from './types';

// ── Lifecycle undo (reverse mutation) ─────────────────────────────────────────

/** The lesson fields a lifecycle action may touch — everything undo must restore. */
export interface LessonLifecycleSnapshot {
  lifecycleStatus: LifecycleStatus;
  cancelReason: string | null;
  comment: string | null;
}

/** Capture BEFORE `markLessonConducted`/`cancelLesson`; pass to `restoreLessonLifecycle`. */
export function lifecycleSnapshot(
  lesson: Pick<Lesson, 'lifecycleStatus' | 'cancelReason' | 'comment'>,
): LessonLifecycleSnapshot {
  return {
    lifecycleStatus: lesson.lifecycleStatus,
    cancelReason: lesson.cancelReason,
    comment: lesson.comment,
  };
}

// ── Money undo (compensating record) ─────────────────────────────────────────

type ReversibleTxn = Pick<
  Transaction,
  'id' | 'studentId' | 'lessonId' | 'subjectId' | 'amount' | 'type' | 'method' | 'reversesId'
>;

/** Input for the compensating row — mirrors the original, linked via `reversesId`. */
export interface ReversalInput {
  studentId: string;
  lessonId: string | null;
  subjectId: string | null;
  amount: number;
  type: Transaction['type'];
  method: Transaction['method'];
  reversesId: string;
}

/**
 * Compensating record for a money action: same links/amount/type as the original,
 * `reversesId` pointing at it. Reversals themselves are terminal — reversing a
 * reversal is redoing the original action, which the UI does by repeating it.
 */
export function reversalOf(txn: ReversibleTxn): ReversalInput {
  if (txn.reversesId != null) {
    throw new Error('cannot reverse a reversal — repeat the original action instead');
  }
  return {
    studentId: txn.studentId,
    lessonId: txn.lessonId,
    subjectId: txn.subjectId,
    amount: txn.amount,
    type: txn.type,
    method: txn.method,
    reversesId: txn.id,
  };
}

/**
 * Effective ledger view: drops every reversal row AND every row it reverses. Applied
 * once at the data boundary (db/hooks), so `payStatusOf`/`debtOf`/finance/analytics
 * all see the ledger as if the undone action never happened — while the append-only
 * history keeps both rows.
 */
export function withoutReversals<T extends { id: string; reversesId: string | null }>(
  transactions: readonly T[],
): T[] {
  const reversed = new Set<string>();
  for (const t of transactions) {
    if (t.reversesId != null) reversed.add(t.reversesId);
  }
  return transactions.filter((t) => t.reversesId == null && !reversed.has(t.id));
}
