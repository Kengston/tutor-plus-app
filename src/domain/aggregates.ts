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
  ExpectationStatus,
  FinanceEntry,
  LessonFormat,
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
type ExpectationSlice = {
  id: string;
  studentId: string;
  amount: number;
  dueAt: number;
  status: ExpectationStatus;
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

/**
 * Selected-day summary under the calendar grid (UI-v2 S4, spec 05 §5.1; prototype
 * `DayGlance`): «Сегодня · N уроков» + «K проведено · следующее в HH:MM». Cancelled
 * lessons are excluded entirely; `nextAt` is the earliest still-active (upcoming/
 * ongoing) lesson's instant, `null` when the day is over (prototype: «день завершён»).
 */
export function daySummary(
  lessons: readonly Pick<LessonSlice, 'lifecycleStatus' | 'startsAt'>[],
): { total: number; done: number; nextAt: number | null } {
  let total = 0;
  let done = 0;
  let nextAt: number | null = null;
  for (const l of lessons) {
    if (l.lifecycleStatus === 'cancelled') continue;
    total += 1;
    if (l.lifecycleStatus === 'done') {
      done += 1;
    } else if (nextAt === null || l.startsAt < nextAt) {
      // upcoming/ongoing — candidate for «следующее в HH:MM»
      nextAt = l.startsAt;
    }
  }
  return { total, done, nextAt };
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
 * The Finance list as a union of view rows (ADR-0011/0015), newest first:
 *   1. every `paid` txn               → a paid row (lesson settlements + standalone income)
 *   2. each non-cancelled lesson with derived `debt`/`expected` status → a derived row
 *      (paid lessons are represented by their paid txn in #1)
 *   3. every standalone `debt` txn    → a debt row
 *   4. every OPEN `Expectation`       → an `expected` row (money promised without a lesson,
 *      ADR-0015; closed ones are settled — their `paid` txn already appears in #1)
 * An `expected` row is never a ledger txn — it is a derived lesson row (#2) or an open
 * expectation (#4).
 */
export function financeEntries(
  lessons: readonly LessonSlice[],
  transactions: readonly TxnSlice[],
  expectations: readonly ExpectationSlice[] = [],
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

  for (const x of expectations) {
    if (x.status !== 'open') continue; // closed → already settled (its `paid` txn is in #1)
    entries.push({
      id: `expectation:${x.id}`,
      kind: 'expected',
      studentId: x.studentId,
      lessonId: null,
      subjectId: null,
      amount: x.amount,
      occurredAt: x.dueAt, // never converts to debt when past-due (ADR-0009/0015)
      method: null,
      source: 'expectation',
    });
  }

  entries.sort((a, b) => b.occurredAt - a.occurredAt);
  return entries;
}

/** Keep only entries whose instant falls in `period` (txn occurredAt / lesson startsAt). */
export function entriesInPeriod(entries: readonly FinanceEntry[], period: Period): FinanceEntry[] {
  return entries.filter((e) => periodContains(period, e.occurredAt));
}

/**
 * Period summary for the Finance header (spec 07 §7.1) — the three figures over the period
 * slice: `received` («Фактически получено» = Σ paid flow), `debt` («Задолженность»), and
 * `expected` («Ожидается» = derived expected-lessons + open Expectations, ADR-0012/0015).
 */
export function periodSummary(
  entries: readonly FinanceEntry[],
): { received: number; debt: number; expected: number } {
  let received = 0;
  let debt = 0;
  let expected = 0;
  for (const e of entries) {
    if (e.kind === 'paid') received += e.amount;
    else if (e.kind === 'debt') debt += e.amount;
    else expected += e.amount; // 'expected' — expected-lessons + open Expectations
  }
  return { received, debt, expected };
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

// ── «Структура дохода» breakdowns (UI-v2 S11, spec 08 §8.1) ──────────────────
// The Overview donut has three interchangeable cuts of the SAME period income:
// Направления (subjectTotals, above), Ученики (per-student), Формат (per lesson-format).

/** Income per student — Σ `paid` amount whose `occurredAt` ∈ period, sorted desc («Ученики»). */
export function incomeByStudent(
  transactions: readonly Pick<TxnSlice, 'type' | 'amount' | 'occurredAt' | 'studentId'>[],
  period: Period,
): { studentId: string; amount: number }[] {
  const acc = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'paid' || !periodContains(period, t.occurredAt)) continue;
    acc.set(t.studentId, (acc.get(t.studentId) ?? 0) + t.amount);
  }
  const out = [...acc].map(([studentId, amount]) => ({ studentId, amount }));
  out.sort((a, b) => b.amount - a.amount);
  return out;
}

/**
 * Income per lesson-format (online / inperson) — `paid` txns joined to their lesson's format,
 * in period, sorted desc («Формат»). A standalone paid op (no `lessonId`) has no format, so it is
 * excluded (the cut is about how sessions were held, not general income).
 */
export function incomeByFormat(
  lessons: readonly { id: string; format: LessonFormat }[],
  transactions: readonly Pick<TxnSlice, 'type' | 'amount' | 'occurredAt' | 'lessonId'>[],
  period: Period,
): { format: LessonFormat; amount: number }[] {
  const fmtOf = new Map<string, LessonFormat>();
  for (const l of lessons) fmtOf.set(l.id, l.format);
  const acc = new Map<LessonFormat, number>();
  for (const t of transactions) {
    if (t.type !== 'paid' || t.lessonId == null || !periodContains(period, t.occurredAt)) continue;
    const f = fmtOf.get(t.lessonId);
    if (f === undefined) continue;
    acc.set(f, (acc.get(f) ?? 0) + t.amount);
  }
  const out = [...acc].map(([format, amount]) => ({ format, amount }));
  out.sort((a, b) => b.amount - a.amount);
  return out;
}

// ── «Выводы» — rule-based Overview insights (UI-v2 S11, spec 08 §8.1) ─────────

/**
 * A structured Overview insight (the screen composes the localized sentence — the generator
 * stays lexicon-free, ADR-0006). `topDirection` = the dominant income direction + its share;
 * `incomeDelta` = income change vs the comparison period.
 */
export type OverviewInsight =
  | { kind: 'topDirection'; subjectId: string | null; pct: number }
  | { kind: 'incomeDelta'; pct: number; dir: 'up' | 'down' };

/**
 * Rule-based «Выводы» for the Overview — PURE, derived from the aggregates (no LLM, spec 08 §8.1).
 * Deliberately conservative: emits an item only when the data genuinely supports it (a dominant
 * direction with income; an income change against a NON-empty comparison baseline). Thin/empty
 * data → `[]`, so the screen shows a correct empty state instead of a meaningless line.
 */
export function overviewInsights(
  transactions: readonly PaidTxnSlice[],
  period: Period,
  comparePeriod: Period,
): OverviewInsight[] {
  const out: OverviewInsight[] = [];

  // (1) Dominant direction by income share (subjectTotals is already income-desc).
  const totals = subjectTotals(transactions, period);
  const total = totals.reduce((s, x) => s + x.amount, 0);
  if (total > 0 && totals[0] && totals[0].amount > 0) {
    out.push({ kind: 'topDirection', subjectId: totals[0].subjectId, pct: Math.round((totals[0].amount / total) * 100) });
  }

  // (2) Income change vs the comparison period — only when the baseline had income (else no %).
  const baseline = incomeInPeriod(transactions, comparePeriod);
  if (baseline > 0) {
    const d = metricDelta(incomeInPeriod(transactions, period), baseline);
    if (d.pct !== null && d.pct !== 0) {
      out.push({ kind: 'incomeDelta', pct: Math.abs(d.pct), dir: d.dir === 'down' ? 'down' : 'up' });
    }
  }

  return out;
}
