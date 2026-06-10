/**
 * Period model (ADR-0012) — pure half-open ranges `[start, end)` in DEVICE-LOCAL time
 * (profile.tz defaults to device; RU has no DST), shared by Finance & Analytics. NO
 * translatable phrasing here — labels are composed in screens via i18n month/weekday
 * keys; this module is numeric/structural only, like `time.ts`.
 *
 * Week is Monday-first (RU). Transactions bucket by `occurredAt`; derived expected/debt
 * lessons bucket by `startsAt` (ADR-0012). `start` is the first instant (inclusive),
 * `end` is the first instant of the NEXT period (exclusive).
 */

export type PeriodType = 'week' | 'month' | 'year' | 'custom';

export interface Period {
  type: PeriodType;
  /** Inclusive local-instant ms of the first moment. */
  start: number;
  /** Exclusive local-instant ms (start of the next period). */
  end: number;
}

const DAY = 86_400_000;

/** Mon-first weekday index (0=Mon … 6=Sun) for a JS getDay() (0=Sun … 6=Sat). */
function monIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/** Local-midnight ms of the day containing `ms` (also the Finance day-group key). */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Week `[Mon 00:00, next Mon 00:00)` containing `ms`. */
export function weekOf(ms: number): Period {
  const dayStart = startOfDay(ms);
  const mon = dayStart - monIndex(new Date(dayStart).getDay()) * DAY;
  return { type: 'week', start: mon, end: mon + 7 * DAY };
}

/** Month `[1st 00:00, 1st of next month 00:00)` containing `ms`. */
export function monthOf(ms: number): Period {
  const d = new Date(ms);
  return {
    type: 'month',
    start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
  };
}

/** Year `[Jan 1 00:00, next Jan 1 00:00)` containing `ms`. */
export function yearOf(ms: number): Period {
  const d = new Date(ms);
  return {
    type: 'year',
    start: new Date(d.getFullYear(), 0, 1).getTime(),
    end: new Date(d.getFullYear() + 1, 0, 1).getTime(),
  };
}

/** Custom range — from local-midnight of the earlier day to the END of the later day (inclusive days). */
export function customRange(aMs: number, bMs: number): Period {
  const lo = startOfDay(Math.min(aMs, bMs));
  const hi = startOfDay(Math.max(aMs, bMs)) + DAY; // exclusive end = next midnight
  return { type: 'custom', start: lo, end: hi };
}

/** Period of the same TYPE as `p`, shifted by `dir` (±1). Custom is returned unchanged. */
export function shiftPeriod(p: Period, dir: number): Period {
  switch (p.type) {
    case 'week':
      return weekOf(p.start + dir * 7 * DAY);
    case 'month': {
      const d = new Date(p.start);
      return monthOf(new Date(d.getFullYear(), d.getMonth() + dir, 1).getTime());
    }
    case 'year': {
      const d = new Date(p.start);
      return yearOf(new Date(d.getFullYear() + dir, 0, 1).getTime());
    }
    default:
      return p;
  }
}

/** Whether `ms` falls inside the half-open `[start, end)`. */
export function periodContains(p: Period, ms: number): boolean {
  return ms >= p.start && ms < p.end;
}

/** The default period — the current month (Finance/Analytics initial view). */
export function currentMonth(now: number = Date.now()): Period {
  return monthOf(now);
}

/**
 * Local-midnight ms of the 1st of each month spanning `[fromMs, toMs]` (inclusive of
 * both endpoints' months) — bucket anchors for monthly analytics bars.
 */
export function monthStarts(fromMs: number, toMs: number): number[] {
  const out: number[] = [];
  const end = new Date(toMs);
  let y = new Date(fromMs).getFullYear();
  let m = new Date(fromMs).getMonth();
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    out.push(new Date(y, m, 1).getTime());
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

/**
 * Mon-first week-start ms for each ISO-ish week overlapping `[fromMs, toMs)` — bucket
 * anchors for weekly analytics bars (Dynamics tab).
 */
export function weekStarts(fromMs: number, toMs: number): number[] {
  const out: number[] = [];
  let w = weekOf(fromMs).start;
  while (w < toMs) {
    out.push(w);
    w += 7 * DAY;
  }
  return out;
}
