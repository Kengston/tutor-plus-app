/**
 * Notification-feed gating (UI-v2 S14, spec 09 §9.3). Pins issue #32: the «Включить
 * уведомления» master switch silences the whole feed, and «Уведомлять о долгах» is a toggle
 * SEPARATE from payment notifications.
 */
import { describe, expect, it } from 'vitest';

import type { ReminderPrefs } from './types';
import { buildFeed } from './notifications';

const NOW = new Date(2026, 6, 16, 12).getTime();
const HOUR = 3_600_000;

/** All-on prefs baseline (inline — importing lib/profile would drag the DB adapter into node). */
const ALL_ON: ReminderPrefs = {
  enabled: true,
  leadMin: 60,
  lessons: true,
  payment: true,
  debts: true,
  schedule: true,
  summary: true,
  pushGranted: false,
};

const paidTxn = { id: 'p1', studentId: 's1', type: 'paid' as const, amount: 1500, occurredAt: NOW - HOUR, lessonId: null };
const debtTxn = { id: 'd1', studentId: 's1', type: 'debt' as const, amount: 2000, occurredAt: NOW - HOUR, lessonId: null };
const student = { id: 's1', name: 'Анна', category: 'terracotta' as const };

const feed = (prefs: Partial<ReminderPrefs>) =>
  buildFeed({
    lessons: [],
    transactions: [paidTxn, debtTxn],
    students: [student],
    prefs: { ...ALL_ON, ...prefs },
    reads: new Set<string>(),
    now: NOW,
  });

describe('buildFeed gating (spec 09 §9.3)', () => {
  it('master switch OFF silences the whole feed regardless of category toggles', () => {
    expect(feed({ enabled: false })).toEqual([]);
  });

  it('debts toggle is separate: debts OFF hides debt rows but keeps payments', () => {
    const kinds = feed({ debts: false }).map((i) => i.kind);
    expect(kinds).toContain('payment');
    expect(kinds).not.toContain('debt');
  });

  it('payment toggle OFF hides paid rows but keeps debts', () => {
    const kinds = feed({ payment: false }).map((i) => i.kind);
    expect(kinds).toContain('debt');
    expect(kinds).not.toContain('payment');
  });

  it('both ON → both kinds present (regression guard for the split loop)', () => {
    const kinds = feed({}).map((i) => i.kind);
    expect(kinds).toContain('payment');
    expect(kinds).toContain('debt');
  });
});
