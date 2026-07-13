/** Meeting-link domain logic (UI-v2 S3): join-button visibility predicate + host label. */
import { describe, expect, it } from 'vitest';

import { canJoinOnline, meetHost } from './lesson-link';

describe('canJoinOnline', () => {
  it('is true only for online lessons with a non-empty link', () => {
    expect(canJoinOnline({ format: 'online', link: 'https://meet.google.com/abc' })).toBe(true);
  });

  it('is false for in-person lessons even with a link', () => {
    expect(canJoinOnline({ format: 'inperson', link: 'https://meet.google.com/abc' })).toBe(false);
  });

  it('is false for online lessons without a link (null, empty, whitespace)', () => {
    expect(canJoinOnline({ format: 'online', link: null })).toBe(false);
    expect(canJoinOnline({ format: 'online', link: '' })).toBe(false);
    expect(canJoinOnline({ format: 'online', link: '   ' })).toBe(false);
  });
});

describe('meetHost', () => {
  it('returns the hostname without the www prefix', () => {
    expect(meetHost('https://meet.google.com/mia-6821-tve')).toBe('meet.google.com');
    expect(meetHost('https://www.zoom.us/j/123')).toBe('zoom.us');
  });

  it('returns null for unparseable values (screen falls back to the i18n label)', () => {
    expect(meetHost('not a url')).toBeNull();
  });
});
