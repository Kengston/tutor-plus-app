/**
 * Working-days helpers (UI-v2 S15, spec 10 §10.1 «Расписание — рабочие дни, напр. „Пн–Пт“»).
 * Stored as a CSV of JS `getDay()` indices on the profile row (`work_days`); null (pre-v9 rows
 * and fresh installs) reads as Пн–Пт. Pure string/number work — no React/DB imports.
 */
import type { StringKey } from '@/i18n';

/** Mon-first display order of JS getDay indices (1=Пн … 0=Вс). */
export const WORK_DAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

/** getDay index → its short-weekday i18n key («Пн»…«Вс»). */
export const WORK_DAY_KEYS: Record<number, StringKey> = {
  1: 'wd.1',
  2: 'wd.2',
  3: 'wd.3',
  4: 'wd.4',
  5: 'wd.5',
  6: 'wd.6',
  0: 'wd.0',
};

/** Default working days — Пн–Пт (what a null column means). */
export const DEFAULT_WORK_DAYS: readonly number[] = [1, 2, 3, 4, 5];

/** CSV column value → getDay indices (null/malformed → the Пн–Пт default). */
export function parseWorkDays(csv: string | null): number[] {
  if (!csv) return [...DEFAULT_WORK_DAYS];
  const days = csv
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length > 0 ? days : [...DEFAULT_WORK_DAYS];
}

/** getDay indices → the CSV column value (Mon-first order, deduplicated). */
export function serializeWorkDays(days: readonly number[]): string {
  return WORK_DAY_ORDER.filter((d) => days.includes(d)).join(',');
}

/**
 * Human label for a set of working days: a single Mon-first RUN reads as a range («Пн–Пт»),
 * anything else lists the picked days («Пн, Ср, Пт»). `dayName` resolves a getDay index to
 * its short name via i18n (this module holds no copy).
 */
export function workDaysLabel(csv: string | null, dayName: (day: number) => string): string {
  const days = parseWorkDays(csv);
  const ordered = WORK_DAY_ORDER.filter((d) => days.includes(d));
  if (ordered.length === 0) return '';
  // Contiguous in Mon-first order → range «первый–последний».
  const first = WORK_DAY_ORDER.indexOf(ordered[0]);
  const isRun = ordered.every((d, i) => WORK_DAY_ORDER[first + i] === d);
  if (isRun && ordered.length > 2) return `${dayName(ordered[0])}–${dayName(ordered[ordered.length - 1])}`;
  return ordered.map(dayName).join(', ');
}
