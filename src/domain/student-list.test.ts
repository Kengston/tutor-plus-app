/** Students-list derivations (UI-v2 S8): next-lesson + filter/sort/search. */
import { describe, expect, it } from 'vitest';

import { filterSortStudents, nextUpcomingAt, type StudentListItem } from './student-list';

const at = (h: number) => Date.UTC(2026, 6, 16, h);
const NOW = at(12);

describe('nextUpcomingAt', () => {
  it('returns the earliest still-active lesson at/after now', () => {
    const out = nextUpcomingAt(
      [
        { startsAt: at(9), lifecycleStatus: 'done' }, // past+done
        { startsAt: at(15), lifecycleStatus: 'upcoming' },
        { startsAt: at(18), lifecycleStatus: 'upcoming' },
      ],
      NOW,
    );
    expect(out).toBe(at(15));
  });

  it('skips cancelled and done and past lessons', () => {
    expect(
      nextUpcomingAt(
        [
          { startsAt: at(14), lifecycleStatus: 'cancelled' },
          { startsAt: at(16), lifecycleStatus: 'done' },
          { startsAt: at(10), lifecycleStatus: 'upcoming' }, // past
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it('returns null for no lessons', () => {
    expect(nextUpcomingAt([], NOW)).toBeNull();
  });
});

function item(over: Partial<StudentListItem> & Pick<StudentListItem, 'id' | 'name'>): StudentListItem {
  return { status: 'active', createdAt: 0, debt: 0, nextLessonAt: null, ...over };
}

describe('filterSortStudents', () => {
  const items = [
    item({ id: 'a', name: 'Борис', status: 'active', debt: 500, nextLessonAt: at(15), createdAt: 3 }),
    item({ id: 'b', name: 'Анна', status: 'paused', debt: 0, nextLessonAt: null, createdAt: 2 }),
    item({ id: 'c', name: 'Виктор', status: 'archived', debt: 0, nextLessonAt: at(20), createdAt: 1 }),
  ];

  it('«all» hides the archive (spec: «Все» без архива)', () => {
    const out = filterSortStudents(items, { filter: 'all', sort: 'name', query: '' });
    expect(out.map((s) => s.id)).toEqual(['b', 'a']); // Анна, Борис — no Виктор (archived)
  });

  it('«hasLessons» keeps only students with a next lesson', () => {
    const out = filterSortStudents(items, { filter: 'hasLessons', sort: 'name', query: '' });
    expect(out.map((s) => s.id).sort()).toEqual(['a', 'c']);
  });

  it('«debtors» keeps only students who owe money', () => {
    const out = filterSortStudents(items, { filter: 'debtors', sort: 'name', query: '' });
    expect(out.map((s) => s.id)).toEqual(['a']);
  });

  it('a status bucket matches its own status only', () => {
    expect(filterSortStudents(items, { filter: 'archived', sort: 'name', query: '' }).map((s) => s.id)).toEqual(['c']);
  });

  it('search matches the name case-insensitively', () => {
    expect(filterSortStudents(items, { filter: 'active', sort: 'name', query: 'бор' }).map((s) => s.id)).toEqual(['a']);
  });

  it('sorts by name / added / status / debt', () => {
    const all = items.map((s) => s.id);
    void all;
    expect(filterSortStudents(items, { filter: 'archived', sort: 'name', query: '' }).map((s) => s.id)).toEqual(['c']);
    // added: newest createdAt first
    const byAdded = filterSortStudents([item({ id: 'x', name: 'X', createdAt: 1 }), item({ id: 'y', name: 'Y', createdAt: 5 })], { filter: 'all', sort: 'added', query: '' });
    expect(byAdded.map((s) => s.id)).toEqual(['y', 'x']);
    // debt: highest first
    const byDebt = filterSortStudents([item({ id: 'p', name: 'P', debt: 100 }), item({ id: 'q', name: 'Q', debt: 900 })], { filter: 'all', sort: 'debt', query: '' });
    expect(byDebt.map((s) => s.id)).toEqual(['q', 'p']);
  });
});
