/**
 * Auth-flow validators (UI-v2 S17, spec 03 §3.2–3.4 / ADR-0014) — pure rules the login,
 * recovery and registration screens share. Spec-verbatim: a contact is an e-mail
 * (`\S+@\S+\.\S+`) OR a phone (first char a digit, then digits/space/`+ - ( )`, length ≥ 6);
 * a password needs «Не менее 8 символов» + «Буква» + «Цифра».
 */

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^\d[\d\s+\-()]{5,}$/;

/** «Email или телефон» — the shared contact rule (spec §3.2). */
export function isValidContact(value: string): boolean {
  const v = value.trim();
  return EMAIL_RE.test(v) || PHONE_RE.test(v);
}

/** The three live-checklist requirements for a new password (spec §3.3/3.4). */
export interface PasswordChecks {
  /** «Не менее 8 символов». */
  length: boolean;
  /** «Буква». */
  letter: boolean;
  /** «Цифра». */
  digit: boolean;
}

export function passwordChecks(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    letter: /\p{L}/u.test(pw),
    digit: /\d/.test(pw),
  };
}

/** All three requirements hold. */
export function isStrongPassword(pw: string): boolean {
  const c = passwordChecks(pw);
  return c.length && c.letter && c.digit;
}

/** The recovery code is exactly six digits (spec §3.3). */
export function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
