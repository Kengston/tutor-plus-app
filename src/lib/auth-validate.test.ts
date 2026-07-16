/** Auth validators (UI-v2 S17, spec 03) — the acceptance-criteria rules verbatim. */
import { describe, expect, it } from 'vitest';

import { isStrongPassword, isValidCode, isValidContact, passwordChecks } from './auth-validate';

describe('isValidContact («Email или телефон», spec §3.2)', () => {
  it('accepts e-mails per \\S+@\\S+\\.\\S+', () => {
    expect(isValidContact('a@b.co')).toBe(true);
    expect(isValidContact('  name@mail.ru ')).toBe(true); // trimmed
    expect(isValidContact('a@b')).toBe(false); // no dot-domain
    expect(isValidContact('@b.co')).toBe(false);
  });

  it('accepts phones: first char a digit, then digits/space/+-(), length ≥ 6', () => {
    expect(isValidContact('79161234567')).toBe(true);
    expect(isValidContact('8 (916) 123-45-67')).toBe(true);
    expect(isValidContact('12345')).toBe(false); // too short
    expect(isValidContact('+7916123')).toBe(false); // must START with a digit
    expect(isValidContact('9a1234567')).toBe(false); // letters not allowed
  });
});

describe('passwordChecks (── «Не менее 8 символов» · «Буква» · «Цифра»)', () => {
  it('reports each requirement independently (live checklist)', () => {
    expect(passwordChecks('abc123')).toEqual({ length: false, letter: true, digit: true });
    expect(passwordChecks('abcdefgh')).toEqual({ length: true, letter: true, digit: false });
    expect(passwordChecks('12345678')).toEqual({ length: true, letter: false, digit: true });
    expect(passwordChecks('пароль12')).toEqual({ length: true, letter: true, digit: true }); // Unicode letters count
  });

  it('isStrongPassword = all three', () => {
    expect(isStrongPassword('abc12345')).toBe(true);
    expect(isStrongPassword('short1')).toBe(false);
  });
});

describe('isValidCode (6 ячеек)', () => {
  it('exactly six digits', () => {
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
  });
});
