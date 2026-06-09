/** RU number formatting — Intl-free (Hermes-safe): space thousands separators. */
export function formatNumberRu(n: number): string {
  const r = Math.round(n);
  const sign = r < 0 ? '-' : '';
  return sign + Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** `1 500 ₽` */
export function formatRub(n: number): string {
  return `${formatNumberRu(n)} ₽`;
}

/** Initials from a name: first + last word initial, uppercased. «Анна Котова» → «АК». */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}
