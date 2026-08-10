/**
 * Dictionary completeness (UI-v2 S18, ADR-0006) — the dual-mode lexicon lives ONLY in
 * key/key_client pairs, so these invariants keep the axis airtight:
 *   1. no base string uses «занятие» — tutor mode says «урок» (spec terminology sweep);
 *   2. every base string carrying tutor lexicon (урок/ученик) has a `_client` twin,
 *      except the explicit allowlist of genuinely mode-neutral strings;
 *   3. every `_client` key has a base counterpart (no orphaned overrides).
 */
import { describe, expect, it } from 'vitest';

import { messages } from './strings';

/** Mode-neutral strings that NAME the axis itself rather than speak in it. */
const NEUTRAL_ALLOWLIST = new Set<string>([
  'mode.student', // the «Ученик» option label — both options are always shown side by side
  'a11y.clientMode', // describes the switch («Режим (ученик/клиент)») — covers both modes
]);

const entries = Object.entries(messages as Record<string, string>);
const keys = new Set(entries.map(([k]) => k));
const TUTOR_LEXICON = /урок|ученик/i;
const CLIENT_LEXICON = /встреч|клиент/i;

/** Base strings that legitimately NAME the client axis itself (the mode picker's «Клиент»
 *  option, the a11y description of the mode switch) rather than leaking client-mode wording
 *  into the tutor-mode UI. Keep this minimal — anything else here is a mirror-test failure. */
const CLIENT_LEXICON_ALLOWLIST = new Set<string>([
  'mode.client', // the «Клиент» option label — both options are always shown side by side
  'a11y.clientMode', // describes the switch («Режим (ученик/клиент)») — covers both modes
]);

/** `_client` overrides that legitimately keep tutor lexicon — currently none. Kept as an
 *  explicit (empty) allowlist so a genuine future exception has a documented home instead of
 *  a silent regex tweak. */
const CLIENT_OVERRIDE_TUTOR_LEXICON_ALLOWLIST = new Set<string>([]);

describe('i18n dual-mode dictionary', () => {
  it('no base string says «занятие» — tutor lexicon is «урок»', () => {
    const offenders = entries
      .filter(([k, v]) => !k.endsWith('_client') && /занят/i.test(v))
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it('every tutor-lexicon base string has a _client twin', () => {
    const missing = entries
      .filter(
        ([k, v]) =>
          !k.endsWith('_client') &&
          TUTOR_LEXICON.test(v) &&
          !keys.has(`${k}_client`) &&
          !NEUTRAL_ALLOWLIST.has(k),
      )
      .map(([k]) => k);
    expect(missing).toEqual([]);
  });

  it('every _client override has a base key', () => {
    const orphans = entries
      .filter(([k]) => k.endsWith('_client') && !keys.has(k.slice(0, -'_client'.length)))
      .map(([k]) => k);
    expect(orphans).toEqual([]);
  });

  it('no base string leaks client lexicon («встреча»/«клиент») outside axis-naming keys', () => {
    const offenders = entries
      .filter(
        ([k, v]) => !k.endsWith('_client') && CLIENT_LEXICON.test(v) && !CLIENT_LEXICON_ALLOWLIST.has(k),
      )
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it('no _client override leaks tutor lexicon («урок»/«ученик»)', () => {
    const offenders = entries
      .filter(
        ([k, v]) =>
          k.endsWith('_client') && TUTOR_LEXICON.test(v) && !CLIENT_OVERRIDE_TUTOR_LEXICON_ALLOWLIST.has(k),
      )
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it('allowlist entries exist and are still lexicon-bearing (no stale exceptions)', () => {
    for (const k of NEUTRAL_ALLOWLIST) {
      expect(keys.has(k), `allowlisted key ${k} vanished from the dictionary`).toBe(true);
      expect(TUTOR_LEXICON.test((messages as Record<string, string>)[k])).toBe(true);
    }
  });
});
