/**
 * Design tokens — ported verbatim from the prototype `t+/Tutor+.html`
 * (`:root` = day / light · `html[data-theme="evening"]` = dark).
 *
 * Single source of truth for colour. Components MUST read colours through
 * `useTheme()` (see ./index) — no inline colour literals downstream.
 */

export interface ColorTokens {
  // surfaces & text
  bg: string;
  surface: string;
  elev: string;
  heading: string;
  body: string;
  muted: string;
  label3: string;
  hairline: string;
  // primary / tint
  primary: string;
  onTint: string;
  primaryLight: string;
  primaryVlight: string;
  primaryDeep: string;
  // accent & status
  accent: string;
  accentSoft: string;
  // accent gradient stops (MultiBarChart highlighted-bar top stop, DayLane past-fill end
  // stop) — review fix TP-REVIEW-0810: both used to hardcode the DAY-theme stop verbatim,
  // so the «Вечер» gradient paired a themed `accent` with a day-lit stop.
  accentGradTop: string;
  accentGradBottom: string;
  paid: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  // stones (neutral fills)
  stoneInactive: string;
  stoneLight: string;
  stone700: string;
  // misc surfaces
  terracotta: string;
  tabbar: string;
  sheetScrim: string;
  // categorical ring/marker accents (used on cards)
  catTerracotta: string;
  catSlate: string;
  catOchre: string;
  catSage: string;
  catRose: string;
  catLavender: string;
}

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  radius: { card: number; sheet: number; control: number; pill: number; field: number; row: number; group: number };
  /** Cross-platform boxShadow string (RN 0.85+ supports `boxShadow`). */
  shadow: { card: string; fab: string; sheet: string; control: string; marker: string; barGlow: string; pill: string; snack: string };
}

export const lightColors: ColorTokens = {
  bg: '#F7F1E3',
  surface: '#FFFDF7',
  elev: '#FFFFFF',
  heading: '#151E2D',
  // Alpha steps aligned to spec 00 §0.1 (UI-v2 S16): body .84 · muted .70 · label3 .46.
  body: 'rgba(21,30,45,0.84)',
  muted: 'rgba(21,30,45,0.70)',
  label3: 'rgba(21,30,45,0.46)',
  hairline: 'rgba(21,30,45,0.12)',
  primary: '#151E2D',
  onTint: '#FFFFFF',
  primaryLight: 'rgba(255,211,100,0.34)',
  primaryVlight: 'rgba(21,30,45,0.05)',
  primaryDeep: '#151E2D',
  accent: '#FFD364',
  accentSoft: 'rgba(255,211,100,0.30)',
  accentGradTop: '#FFE6A6',
  accentGradBottom: '#E8B43C',
  paid: '#27360D',
  warning: '#E0A93A',
  warningLight: 'rgba(224,169,58,0.18)',
  danger: '#B5482A',
  dangerLight: 'rgba(181,72,42,0.12)',
  stoneInactive: 'rgba(21,30,45,0.32)',
  stoneLight: 'rgba(21,30,45,0.05)',
  stone700: 'rgba(21,30,45,0.55)',
  terracotta: '#C97F5D',
  tabbar: 'rgba(247,241,227,0.70)',
  sheetScrim: 'rgba(21,30,45,0.34)',
  catTerracotta: '#9A4B28',
  catSlate: '#3D566D',
  catOchre: '#7B6328',
  catSage: '#3F5C49',
  catRose: '#7B4555',
  catLavender: '#534A75',
};

/**
 * «Вечер» — канон v4.1 (дизайн-система v2 §3), похексно. Сине-чернильная палитра
 * ЗАМЕНИЛА прежний тёплый коричневый набор (#1A1613/#EBB65C): тот расходился с
 * макетами v4.1 — см. слайс #70 спеки #68.
 *
 * Фирменный приём канона: вечером ЯНТАРЬ БЕРЁТ РОЛЬ ДЕЙСТВИЯ — `primary` = `accent`
 * = #FFD364, а не белые кнопки. Это же единственное осознанное исключение из «правила
 * жёлтого» (§4): днём жёлтый — только бренд-акцент, вечером он ещё и primary/warning.
 *
 * Значения сняты ПОБУКВЕННО с `html[data-theme="evening"]` прототипа v4.1 (`Tutor+.html`),
 * включая alpha-ступени поверх ivory-заголовка #F3ECDD (.84 / .70 / .46 / .13) — не
 * пересчитывать «на глаз»: канон здесь и есть источник правды.
 */
export const darkColors: ColorTokens = {
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
  primaryDeep: '#FFD364',
  accent: '#FFD364',
  accentSoft: 'rgba(255,211,100,0.22)',
  // Вечерний `accent` совпадает с дневным (#FFD364), поэтому и стопы градиента те же:
  // верх уходит в сливочный, низ — в тёмный янтарь.
  accentGradTop: '#FFE6A6',
  accentGradBottom: '#E8B43C',
  paid: '#9CB87E',
  warning: '#FFD364',
  warningLight: 'rgba(255,211,100,0.18)',
  danger: '#E08A6A',
  dangerLight: 'rgba(224,138,106,0.16)',
  stoneInactive: 'rgba(243,236,221,0.46)',
  stoneLight: 'rgba(243,236,221,0.06)',
  stone700: 'rgba(243,236,221,0.70)',
  // not overridden in the evening theme — inherit day values
  terracotta: '#C97F5D',
  tabbar: 'rgba(20,24,32,0.66)',
  // Канон §3: вечерний скрим глубже дневного — 0.6.
  sheetScrim: 'rgba(0,0,0,0.60)',
  catTerracotta: '#9A4B28',
  catSlate: '#3D566D',
  catOchre: '#7B6328',
  catSage: '#3F5C49',
  catRose: '#7B4555',
  catLavender: '#534A75',
};

const radius = { card: 22, sheet: 26, control: 12, pill: 999, field: 14, row: 16, group: 18 } as const;

export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  radius,
  shadow: {
    card: '0px 12px 32px -22px rgba(0,0,0,0.18)',
    fab: '0px 10px 24px -6px rgba(0,0,0,0.35)',
    sheet: '0px -10px 40px -12px rgba(0,0,0,0.3)',
    control: '0px 1px 3px rgba(0,0,0,0.12)',
    marker: '0 1px 4px rgba(0,0,0,0.25)',
    barGlow: '0px 4px 12px -4px rgba(232,180,60,0.6)',
    pill: '0px 1px 3px rgba(0,0,0,0.12)',
    snack: '0px 16px 34px -14px rgba(0,0,0,0.5)',
  },
};

export const darkTheme: Theme = {
  scheme: 'dark',
  colors: darkColors,
  radius,
  shadow: {
    card: '0px 14px 34px -22px rgba(0,0,0,0.55)',
    fab: '0px 10px 24px -6px rgba(0,0,0,0.35)',
    sheet: '0px -10px 40px -12px rgba(0,0,0,0.3)',
    control: '0px 1px 3px rgba(0,0,0,0.12)',
    marker: '0 1px 4px rgba(0,0,0,0.25)',
    barGlow: '0px 4px 12px -4px rgba(232,180,60,0.6)',
    pill: '0px 1px 3px rgba(0,0,0,0.12)',
    snack: '0px 16px 34px -14px rgba(0,0,0,0.5)',
  },
};

/**
 * Categorical student/client colours (`CAT_COLORS` in the prototype).
 * Theme-independent. `bg`/`text` for the avatar, `accent` for ring/marker.
 */
export const catColors = {
  terracotta: { bg: '#F2E1D8', text: '#9A4B28', accent: '#C97F5D' },
  slate: { bg: '#DCE6EE', text: '#3D566D', accent: '#7A95B0' },
  ochre: { bg: '#EFE6CF', text: '#7B6328', accent: '#C9A961' },
  sage: { bg: '#E3EBE0', text: '#3F5C49', accent: '#84A98C' },
  rose: { bg: '#EFDFE3', text: '#7B4555', accent: '#C9899B' },
  lavender: { bg: '#E5E1ED', text: '#534A75', accent: '#9B8FBE' },
} as const;

export type CatColor = keyof typeof catColors;

/**
 * Ring's gradient stops (`ui/Ring.tsx`) — intentionally FROZEN brand colours (top-left →
 * bottom-right), matched verbatim from the prototype. INVARIANT: Ring stays deliberately
 * OUTSIDE the light/dark theme system — do NOT wire these to `accentGrad*`/`accent` above;
 * this constant exists only so the exception lives in tokens.ts instead of a component
 * comment (review fix TP-REVIEW-0810).
 */
export const brandGradient = {
  from: '#FFE6A6',
  mid: '#FFD364',
  to: '#E8B43C',
} as const;

/** Multi-series chart palette — DERIVED from the categorical accents so avatars, calendar
 *  markers and charts share ONE source of truth (UI-v2 S16 «сведение двух наборов»). */
export const chartColors = [
  catColors.slate.accent,
  catColors.rose.accent,
  catColors.sage.accent,
  catColors.ochre.accent,
  catColors.lavender.accent,
  catColors.terracotta.accent,
] as const;
