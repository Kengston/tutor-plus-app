/**
 * «Настройка главной» (UI-v2 S16, spec 10 §10.1) — which OPTIONAL Today blocks are visible.
 * Stored as a CSV on the profile (`home_blocks`, v10); null = everything visible. «Ваш день»
 * and «Далее сегодня» are REQUIRED (locked in the UI) and never stored here.
 */

/** The toggleable Today blocks. */
export type HomeBlock = 'nearest' | 'tomorrow';

export const OPTIONAL_HOME_BLOCKS: readonly HomeBlock[] = ['nearest', 'tomorrow'];

/** CSV → the visible optional blocks (null/garbage → all visible). */
export function parseHomeBlocks(csv: string | null): HomeBlock[] {
  if (csv == null) return [...OPTIONAL_HOME_BLOCKS];
  const picked = csv.split(',').filter((s): s is HomeBlock => (OPTIONAL_HOME_BLOCKS as string[]).includes(s));
  return picked;
}

/** Visible blocks → the stored CSV (stable order; empty set stores as ''). */
export function serializeHomeBlocks(blocks: readonly HomeBlock[]): string {
  return OPTIONAL_HOME_BLOCKS.filter((b) => blocks.includes(b)).join(',');
}
