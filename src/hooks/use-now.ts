import { useEffect, useState } from 'react';

import { nowMs } from '@/lib/time';

/**
 * Ticking clock (ADR-0013 follow-up) — re-renders every `intervalMs` so the DERIVED feed's
 * time-relative surfaces refresh while a screen stays open: a reminder appearing when its
 * lead-time window opens, the daily-summary at 08:00, day-bucket rollover at midnight, and the
 * «через N минут» subtitles. Minute granularity is enough (reminders/summary are minute-level)
 * and keeps re-render churn low. Pass the result as `now` into `buildFeed`.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => nowMs());
  useEffect(() => {
    const id = setInterval(() => setNow(nowMs()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
