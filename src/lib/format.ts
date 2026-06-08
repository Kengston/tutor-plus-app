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
