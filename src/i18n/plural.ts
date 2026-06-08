/**
 * Russian pluralisation helper (ADR-0003). Returns the correct word FORM for
 * `n`; callers compose the number themselves, e.g.
 *   `${n} ${plural(n, { one: t('unit.students.one'), few: ..., many: ... })}`
 *
 * RU rules (CLDR): one → 1, 21, 31… (but not 11); few → 2–4, 22–24…
 * (but not 12–14); many → everything else (0, 5–20, 11–14…).
 */
export function plural(n: number, forms: { one: string; few: string; many: string }): string {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (mod10 === 1 && abs !== 11) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && (abs < 12 || abs > 14)) return forms.few;
  return forms.many;
}
