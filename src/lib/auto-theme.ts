/**
 * «Авто» theme clock rule (UI-v2 S16, ADR-0017): the evening palette applies from 19:00 to
 * 7:00 LOCAL time — the OS colour scheme deliberately does not participate (the product fixed
 * this behaviour twice; a «Как в системе» card can be added later, backward-compatibly).
 * Pure hour math — the ThemeProvider owns the timer/focus wiring.
 */

/** Evening window bounds (local hours). */
export const EVENING_FROM_HOUR = 19;
export const EVENING_TO_HOUR = 7;

/** Whether the instant falls inside the evening window (19:00 ≤ t < 24:00 or 0:00 ≤ t < 7:00). */
export function isEveningAt(ms: number): boolean {
  const h = new Date(ms).getHours();
  return h >= EVENING_FROM_HOUR || h < EVENING_TO_HOUR;
}

/**
 * Milliseconds until the NEXT theme boundary (the coming 19:00 or 7:00) — the provider sleeps
 * exactly this long and re-evaluates. Always > 0.
 */
export function msUntilThemeBoundary(ms: number): number {
  const d = new Date(ms);
  const boundary = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const h = d.getHours();
  if (h < EVENING_TO_HOUR) {
    boundary.setHours(EVENING_TO_HOUR); // today 07:00
  } else if (h < EVENING_FROM_HOUR) {
    boundary.setHours(EVENING_FROM_HOUR); // today 19:00
  } else {
    boundary.setDate(boundary.getDate() + 1); // tomorrow 07:00
    boundary.setHours(EVENING_TO_HOUR);
  }
  return boundary.getTime() - ms;
}
