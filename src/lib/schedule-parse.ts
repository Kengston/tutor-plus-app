/**
 * Legacy schedule-string parser (UI-v2 S6, ADR-0016 migration). Turns the old free-form
 * `Student.schedule` value («Пн, Ср · 16:00») into structured slot seeds. This reads a
 * FIXED legacy data format (RU weekday abbreviations as stored by earlier phases) — it is
 * data-format parsing, not display lexicon, hence it lives in `lib/` (like `format.ts`),
 * not the neutral domain. Best-effort: an unparseable string yields `[]` (the migration
 * then leaves the student without slots and asks them to fill the schedule editor).
 */

/** A parsed weekday+time pair — the caller fills the remaining slot fields from the student. */
export interface SlotSeed {
  /** 0=Sun … 6=Sat (JS getDay convention). */
  weekday: number;
  /** Minutes from local midnight. */
  timeMin: number;
}

/** RU weekday abbreviations as stored in the legacy `schedule` string → JS getDay index. */
const WEEKDAY_ABBR: Record<string, number> = {
  вс: 0,
  пн: 1,
  вт: 2,
  ср: 3,
  чт: 4,
  пт: 5,
  сб: 6,
};

/**
 * Parse «Пн, Ср · 16:00» → `[{weekday:1,timeMin:960},{weekday:3,timeMin:960}]`. Tolerant of
 * separators (comma / whitespace / the «·» middle dot) and of a missing time (then `[]`,
 * since a slot needs a time). Unknown tokens are skipped; no recognized weekday → `[]`.
 */
export function parseScheduleString(raw: string): SlotSeed[] {
  if (!raw) return [];
  // Time: the first HH:MM anywhere in the string.
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return [];
  const hh = Number(timeMatch[1]);
  const mm = Number(timeMatch[2]);
  if (hh > 23 || mm > 59) return [];
  const timeMin = hh * 60 + mm;

  // Weekdays: everything before the time, tokenized on non-letter separators.
  const daysPart = raw.slice(0, timeMatch.index ?? 0);
  const seen = new Set<number>();
  const seeds: SlotSeed[] = [];
  for (const token of daysPart.split(/[^А-Яа-яЁё]+/)) {
    const wd = WEEKDAY_ABBR[token.trim().toLowerCase()];
    if (wd === undefined || seen.has(wd)) continue;
    seen.add(wd);
    seeds.push({ weekday: wd, timeMin });
  }
  return seeds;
}
