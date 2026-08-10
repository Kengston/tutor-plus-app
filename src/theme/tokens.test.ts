/**
 * Канон палитр (дизайн-система v2 §2–§4, слайс #70 спеки #68).
 *
 * Тест снимает ЗНАЧЕНИЯ, а не реализацию: цвет — это внешнее поведение темы, и именно
 * похексное совпадение с каноном отличает «вечер v4.1» от прежнего тёплого набора.
 * Проверяются только те токены, которые канон называет явно, плюс два инварианта,
 * которые легко сломать вслепую: «вечером янтарь берёт роль действия» и «светлая тема
 * уже канон — её не трогаем».
 */
import { describe, expect, it } from 'vitest';

import { darkColors, lightColors } from './tokens';

/** Канон v4.1 §3 — вечерняя палитра, побуквенно из `html[data-theme="evening"]` прототипа. */
const EVENING_CANON = {
  bg: '#13161D',
  surface: '#222A38',
  elev: '#2B3547',
  heading: '#F3ECDD',
  body: 'rgba(243,236,221,0.84)',
  muted: 'rgba(243,236,221,0.70)',
  label3: 'rgba(243,236,221,0.46)',
  hairline: 'rgba(243,236,221,0.13)',
  primary: '#FFD364',
  onTint: '#1B1407',
  primaryLight: 'rgba(255,211,100,0.20)',
  primaryVlight: 'rgba(243,236,221,0.06)',
  accent: '#FFD364',
  accentSoft: 'rgba(255,211,100,0.22)',
  paid: '#9CB87E',
  danger: '#E08A6A',
  dangerLight: 'rgba(224,138,106,0.16)',
  warning: '#FFD364',
  warningLight: 'rgba(255,211,100,0.18)',
  stoneInactive: 'rgba(243,236,221,0.46)',
  stoneLight: 'rgba(243,236,221,0.06)',
  stone700: 'rgba(243,236,221,0.70)',
  tabbar: 'rgba(20,24,32,0.66)',
  sheetScrim: 'rgba(0,0,0,0.60)',
} as const;

/** Канон v4.1 §2 — дневная палитра; слайс её не меняет, тест это фиксирует. */
const DAY_CANON = {
  bg: '#F7F1E3',
  surface: '#FFFDF7',
  elev: '#FFFFFF',
  heading: '#151E2D',
  primary: '#151E2D',
  onTint: '#FFFFFF',
  accent: '#FFD364',
  paid: '#27360D',
  warning: '#E0A93A',
  danger: '#B5482A',
} as const;

describe('палитра «Вечер» — канон v4.1', () => {
  it.each(Object.entries(EVENING_CANON))('%s = %s', (token, value) => {
    expect(darkColors[token as keyof typeof EVENING_CANON]).toBe(value);
  });

  it('вечером янтарь берёт роль действия: primary = accent', () => {
    expect(darkColors.primary).toBe(darkColors.accent);
  });

  it('производные alpha построены на ivory-заголовке #F3ECDD', () => {
    for (const token of ['body', 'muted', 'label3', 'hairline', 'stoneLight', 'stone700'] as const) {
      expect(darkColors[token]).toMatch(/^rgba\(243,236,221,/);
    }
  });

  it('фон вечера сине-чернильный, а не тёплый коричневый', () => {
    // Прежний набор был #1A1613 (R > B). Канон v4.1 — холодный: синева перевешивает.
    const [r, , b] = [1, 3, 5].map((i) => Number.parseInt(darkColors.bg.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
  });
});

describe('палитра «День» — канон v4.1 (слайсом не меняется)', () => {
  it.each(Object.entries(DAY_CANON))('%s = %s', (token, value) => {
    expect(lightColors[token as keyof typeof DAY_CANON]).toBe(value);
  });

  it('правило жёлтого: днём бренд-акцент и warning — разные роли', () => {
    expect(lightColors.accent).not.toBe(lightColors.warning);
  });
});
