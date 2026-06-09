/**
 * Time helpers — pure numeric/clock utilities over UTC-instant ms (ADR-0005).
 * Phase 1 renders day boundaries / clock in the DEVICE local zone (profile.tz
 * defaults to device; RU has no DST). NO translatable phrasing here — relative
 * wording («через N минут») is composed in components via i18n + `plural()`.
 */

/** Local-midnight bounds of the day containing `now` (ms). */
export function dayBounds(now: number = Date.now()): { start: number; end: number } {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return { start, end: start + 86_400_000 };
}

/** Local-midnight bounds of the day `offsetDays` away (e.g. +1 = tomorrow). */
export function dayBoundsOffset(offsetDays: number, now: number = Date.now()): { start: number; end: number } {
  const { start } = dayBounds(now);
  const s = start + offsetDays * 86_400_000;
  return { start: s, end: s + 86_400_000 };
}

/** Position of an instant within [startHour, endHour] as 0..1 (for DayLane). */
export function fracOfDay(ms: number, startHour = 9, endHour = 21): number {
  const d = new Date(ms);
  const hours = d.getHours() + d.getMinutes() / 60;
  return Math.min(1, Math.max(0, (hours - startHour) / (endHour - startHour)));
}

/** Whole minutes from `now` until `ms` (negative if past). */
export function minutesUntil(ms: number, now: number = Date.now()): number {
  return Math.round((ms - now) / 60_000);
}

/** `HH:MM` clock in device-local time (tabular, not a translatable string). */
export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Day-of-month, for calendar dots. */
export function dayOfMonth(ms: number): number {
  return new Date(ms).getDate();
}

/** Current instant in epoch ms (UTC). A named wrapper so screens read `nowMs()`. */
export function nowMs(): number {
  return Date.now();
}
