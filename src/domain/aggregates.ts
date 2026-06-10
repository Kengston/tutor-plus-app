/**
 * Pure derived-value layer (ADR-0008/0011). The SINGLE source of truth for money is the
 * append-only `transactions` ledger; `Student.debt`, `Lesson.payStatus`, every Finance row
 * and every Analytics number are never stored — they are COMPUTED here, client-side,
 * offline-first.
 *
 * Functions are typed over minimal structural slices so both plain DTOs (`./types`) and
 * WatermelonDB model instances satisfy them — keeping this module free of any persistence/
 * React dependency, hence trivially testable and portable (heavy/period aggregates may move
 * server-side in Phase 4, same contract).
 *
 * Phase 2 (ADR-0011): debt now SETTLES (append a `paid` txn linked to the same lesson →
 * payStatusOf flips to `paid`), so `debtOf` nets settled lessons out. Intentional Phase-2
 * limits: full-payment only (no partial), no FIFO/credit/packages — see TODO(Phase 3).
 */
import { periodContains, type Period } from '@/lib/period';

import type {
  FinanceEntry,
  LifecycleStatus,
  PayMethod,
  PayStatus,
  TxnType,
} from './types';

// ── Structural slices (model instances & DTOs both satisfy these) ────────────
type TxnSlice = {
  id: string;
  studentId: string;
  type: TxnType;
  amount: number;
  lessonId: string | null;
  subjectId: string | null;
  occurredAt: number;
  method: PayMethod | null;
};
type LessonSlice = {
  id: string;
  studentId: string;
  subjectId: string | null;
  price: number;
  startsAt: number;
  lifecycleStatus: LifecycleStatus;
};

// ── Phase-1 derivations (unchanged contract) ─────────────────────────────────

/**
 * Payment status of a lesson, derived from its DIRECTLY-linked transactions:
 * any linked `paid` → 'paid'; else any linked `debt` → 'debt'; else 'expected'
 * (future or not-yet-recorded). Settlement (ADR-0011) appends a linked `paid`,
 * so a settled debt-lesson reads `paid` here.
 */
export function payStatusOf(
  lessonId: string,
  transactions: readonly Pick<TxnSlice, 'type' | 'lessonId'>[],
): PayStatus {
  let hasDebtLink = false;
  for (const t of transactions) {
    if (t.lessonId !== lessonId) continue;
    if (t.type === 'paid') return 'paid';
    if (t.type === 'debt') hasDebtLink = true;
  }
  return hasDebtLink ? 'debt' : 'expected';
}

/** «проведено N из M» — lifecycle aggregate (NOT payment) over a set of lessons. */
export function doneOfTotal(
  lessons: readonly Pick<LessonSlice, 'lifecycleStatus'>[],
): { done: number; total: number } {
  let done = 0;
  for (const l of lessons) if (l.lifecycleStatus === 'done') done += 1;
  return { done, total: lessons.length };
}

// ── Debt (Phase-2 netting, ADR-0011) ─────────────────────────────────────────

type DebtTxnSlice = Pick<TxnSlice, 'type' | 'amount' | 'lessonId'>;

/**
 * Outstanding debt of a student, computed from their transactions alone (ADR-0011):
 *   Σ debt-amount over lessons with a `debt`-txn and NO `paid`-txn   (lesson-anchored)
 * + max(0, Σ standaloneDebt − Σ standalonePaid)                       (operations w/o lesson)
 *
 * Settled lessons net out because their linked `paid` clears the lesson term; standalone
 * payments only offset standalone debts (no FIFO into lesson debts yet). Non-breaking vs
 * Phase 1: callers still pass one student's txns (slices carry `lessonId`).
 * TODO(Phase 3): partial payments, FIFO allocation, prepayment/credit, packages.
 */
export function debtOf(transactions: readonly DebtTxnSlice[]): number {
  const byLesson = new Map<string, { debt: number; paid: boolean }>();
  let standaloneDebt = 0;
  let standalonePaid = 0;

  for (const t of transactions) {
    if (t.lessonId == null) {
      if (t.type === 'debt') standaloneDebt += t.amount;
      else if (t.type === 'paid') standalonePaid += t.amount;
      continue;
    }
    const e = byLesson.get(t.lessonId) ?? { debt: 0, paid: false };
    if (t.type === 'debt') e.debt += t.amount;
    else if (t.type === 'paid') e.paid = true;
    byLesson.set(t.lessonId, e);
  }

  let total = 0;
  for (const e of byLesson.values()) if (!e.paid) total += e.debt;
  return total + Math.max(0, standaloneDebt - standalonePaid);
}

/** Whether a student currently owes money (drives the «Есть долг» filter & card badge). */
export function hasDebt(transactions: readonly DebtTxnSlice[]): boolean {
  return debtOf(transactions) > 0;
}

/** Outstanding debt per student over the WHOLE ledger — for the Analytics debtors list. */
export function debtors(
  transactions: readonly (DebtTxnSlice & Pick<TxnSlice, 'studentId'>)[],
): { studentId: string; amount: number }[] {
  const byStudent = new Map<string, DebtTxnSlice[]>();
  for (const t of transactions) {
    const arr = byStudent.get(t.studentId);
    if (arr) arr.push(t);
    else byStudent.set(t.studentId, [t]);
  }
  const out: { studentId: string; amount: number }[] = [];
  for (const [studentId, list] of byStudent) {
    const amount = debtOf(list);
    if (amount > 0) out.push({ studentId, amount });
  }
  out.sort((a, b) => b.amount - a.amount);
  return out;
}

// ── Finance entries (view-model union, ADR-0011) ─────────────────────────────

/** Per-lesson linked-txn presence — internal cache so financeEntries is O(L+T), not O(L·T). */
function linkedStatusMap(
  transactions: readonly Pick<TxnSlice, 'type' | 'lessonId'>[],
): Map<string, PayStatus> {
  const flags = new Map<string, { paid: boolean; debt: boolean }>();
  for (const t of transactions) {
    if (t.lessonId == null) continue;
    const e = flags.get(t.lessonId) ?? { paid: false, debt: false };
    if (t.type === 'paid') e.paid = true;
    else if (t.type === 'debt') e.debt = true;
    flags.set(t.lessonId, e);
  }
  const status = new Map<string, PayStatus>();
  for (const [id, e] of flags) status.set(id, e.paid ? 'paid' : e.debt ? 'debt' : 'expected');
  return status;
}

/**
 * The Finance list as a union of view rows (ADR-0011), newest first:
 *   1. every `paid` txn               → a paid row (lesson settlements + standalone income)
 *   2. each non-cancelled lesson with derived `debt`/`expected` status → a derived row
 *      (paid lessons are represented by their paid txn in #1)
 *   3. every standalone `debt` txn    → a debt row
 * `expected` rows are never stored — always derived from a lesson with no linked txn.
 */
export function financeEntries(
  lessons: readonly LessonSlice[],
  transactions: readonly TxnSlice[],
): FinanceEntry[] {
  const entries: FinanceEntry[] = [];
  const linked = linkedStatusMap(transactions);

  for (const t of transactions) {
    if (t.type === 'paid') {
      entries.push({
        id: t.id,
        kind: 'paid',
        studentId: t.studentId,
        lessonId: t.lessonId,
        subjectId: t.subjectId,
        amount: t.amount,
        occurredAt: t.occurredAt,
        method: t.method,
        source: 'txn',
      });
    }
  }

  for (const l of lessons) {
    if (l.lifecycleStatus === 'cancelled') continue; // no money event from a cancelled lesson
    const status = linked.get(l.id) ?? 'expected';
    if (status === 'paid') continue; // represented by its paid txn above
    entries.push({
      id: `lesson:${l.id}`,
      kind: status,
      studentId: l.studentId,
      lessonId: l.id,
      subjectId: l.subjectId,
      amount: l.price,
      occurredAt: l.startsAt,
      method: null,
      source: 'lesson',
    });
  }

  for (const t of transactions) {
    if (t.lessonId == null && t.type === 'debt') {
      entries.push({
        id: t.id,
        kind: 'debt',
        studentId: t.studentId,
        lessonId: null,
        subjectId: t.subjectId,
        amount: t.amount,
        occurredAt: t.occurredAt,
        method: t.method,
        source: 'txn',
      });
    }
  }

  entries.sort((a, b) => b.occurredAt - a.occurredAt);
  return entries;
}

/** Keep only entries whose instant falls in `period` (txn occurredAt / lesson startsAt). */
export function entriesInPeriod(entries: readonly FinanceEntry[], period: Period): FinanceEntry[] {
  return entries.filter((e) => periodContains(period, e.occurredAt));
}

/** Period summary for the Finance header — received (flow) + debt (in-period), ADR-0012. */
export function periodSummary(entries: readonly FinanceEntry[]): { received: number; debt: number } {
  let received = 0;
  let debt = 0;
  for (const e of entries) {
    if (e.kind === 'paid') received += e.amount;
    else if (e.kind === 'debt') debt += e.amount;
  }
  return { received, debt };
}

// ── Analytics aggregates (ADR-0012) ──────────────────────────────────────────

type PaidTxnSlice = Pick<TxnSlice, 'type' | 'amount' | 'occurredAt' | 'subjectId' | 'studentId'>;

/** Σ `paid` amount whose `occurredAt` ∈ period — the income flow. */
export function incomeInPeriod(transactions: readonly PaidTxnSlice[], period: Period): number {
  let total = 0;
  for (const t of transactions) {
    if (t.type === 'paid' && periodContains(period, t.occurredAt)) total += t.amount;
  }
  return total;
}

/**
 * Σ `paid` amount per bucket — bars for Overview (months) and Dynamics (weeks). `bucketOf`
 * maps an instant to its bucket-anchor (e.g. `(ms) => monthOf(ms).start`); `buckets` are the
 * anchors to report, in order. Returns a parallel array of sums.
 */
export function paidByBucket(
  transactions: readonly PaidTxnSlice[],
  buckets: readonly number[],
  bucketOf: (ms: number) => number,
): number[] {
  const acc = new Map<number, number>();
  for (const b of buckets) acc.set(b, 0);
  for (const t of transactions) {
    if (t.type !== 'paid') continue;
    const b = bucketOf(t.occurredAt);
    const cur = acc.get(b);
    if (cur !== undefined) acc.set(b, cur + t.amount);
  }
  return buckets.map((b) => acc.get(b) ?? 0);
}

/** Count of conducted (done) lessons per bucket (by `startsAt`) — bars for the Dynamics tab. */
export function lessonsByBucket(
  lessons: readonly LessonSlice[],
  buckets: readonly number[],
  bucketOf: (ms: number) => number,
): number[] {
  const acc = new Map<number, number>();
  for (const b of buckets) acc.set(b, 0);
  for (const l of lessons) {
    if (l.lifecycleStatus !== 'done') continue;
    const b = bucketOf(l.startsAt);
    const cur = acc.get(b);
    if (cur !== undefined) acc.set(b, cur + 1);
  }
  return buckets.map((b) => acc.get(b) ?? 0);
}

/** Count of conducted (done) lessons whose `startsAt` ∈ period. */
export function lessonsConductedInPeriod(lessons: readonly LessonSlice[], period: Period): number {
  let n = 0;
  for (const l of lessons) {
    if (l.lifecycleStatus === 'done' && periodContains(period, l.startsAt)) n += 1;
  }
  return n;
}

/** Count of cancelled lessons whose `startsAt` ∈ period. */
export function cancellationsInPeriod(lessons: readonly LessonSlice[], period: Period): number {
  let n = 0;
  for (const l of lessons) {
    if (l.lifecycleStatus === 'cancelled' && periodContains(period, l.startsAt)) n += 1;
  }
  return n;
}

/** Average payment in period = received / count(paid) (rounded; 0 if none). */
export function avgCheckInPeriod(transactions: readonly PaidTxnSlice[], period: Period): number {
  let sum = 0;
  let n = 0;
  for (const t of transactions) {
    if (t.type === 'paid' && periodContains(period, t.occurredAt)) {
      sum += t.amount;
      n += 1;
    }
  }
  return n === 0 ? 0 : Math.round(sum / n);
}

/** Income share per subject (from `paid` in period), sorted desc — for the Overview donut. */
export function subjectTotals(
  transactions: readonly PaidTxnSlice[],
  period: Period,
): { subjectId: string | null; amount: number }[] {
  const acc = new Map<string | null, number>();
  for (const t of transactions) {
    if (t.type !== 'paid' || !periodContains(period, t.occurredAt)) continue;
    acc.set(t.subjectId, (acc.get(t.subjectId) ?? 0) + t.amount);
  }
  const out = [...acc].map(([subjectId, amount]) => ({ subjectId, amount }));
  out.sort((a, b) => b.amount - a.amount);
  return out;
}

export interface DirectionStat {
  subjectId: string | null;
  /** Σ paid in period. */
  amount: number;
  /** Conducted lessons in period. */
  lessons: number;
  /** Distinct students active in this direction in period. */
  students: number;
  /** Outstanding debt attributed to this direction (in period, by lesson startsAt). */
  debt: number;
}

/** Per-direction breakdown for the «Топ направлений» list (ranked by income). */
export function topDirections(
  lessons: readonly LessonSlice[],
  transactions: readonly TxnSlice[],
  period: Period,
): DirectionStat[] {
  const stat = new Map<string | null, { amount: number; lessons: number; students: Set<string>; debt: number }>();
  const get = (id: string | null) => {
    let s = stat.get(id);
    if (!s) {
      s = { amount: 0, lessons: 0, students: new Set(), debt: 0 };
      stat.set(id, s);
    }
    return s;
  };

  for (const t of transactions) {
    if (t.type === 'paid' && periodContains(period, t.occurredAt)) {
      const s = get(t.subjectId);
      s.amount += t.amount;
      s.students.add(t.studentId);
    }
  }

  const linked = linkedStatusMap(transactions);
  for (const l of lessons) {
    if (l.lifecycleStatus === 'cancelled' || !periodContains(period, l.startsAt)) continue;
    const s = get(l.subjectId);
    if (l.lifecycleStatus === 'done') {
      s.lessons += 1;
      s.students.add(l.studentId);
    }
    if ((linked.get(l.id) ?? 'expected') === 'debt') s.debt += l.price;
  }

  const out: DirectionStat[] = [...stat].map(([subjectId, s]) => ({
    subjectId,
    amount: s.amount,
    lessons: s.lessons,
    students: s.students.size,
    debt: s.debt,
  }));
  out.sort((a, b) => b.amount - a.amount);
  return out;
}

/** Delta of a metric between the current and a comparison period. `dir` is sign-only — the
 *  screen decides whether up/down is good (income up = good; debt down = good). */
export function metricDelta(
  current: number,
  previous: number,
): { abs: number; pct: number | null; dir: 'up' | 'down' | 'flat' } {
  const abs = current - previous;
  const pct = previous === 0 ? null : Math.round((abs / previous) * 100);
  return { abs, pct, dir: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat' };
}
