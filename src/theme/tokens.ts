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

/** «Вечер» — the prototype's `html[data-theme="evening"]` palette VERBATIM (UI-v2 S16, spec 00:
 *  фон #1A1613, акцент #EBB65C; the previous blue-ish dark set diverged from the mockups). */
export const darkColors: ColorTokens = {
  bg: '#1A1613',
  surface: '#242019',
  elev: '#2C2620',
  heading: '#F1E8D8',
  body: 'rgba(241,232,216,0.85)',
  muted: 'rgba(241,232,216,0.66)',
  label3: 'rgba(241,232,216,0.44)',
  hairline: 'rgba(241,232,216,0.11)',
  primary: '#EBB65C',
  onTint: '#23190A',
  primaryLight: 'rgba(235,182,92,0.22)',
  primaryVlight: 'rgba(241,232,216,0.055)',
  primaryDeep: '#EBB65C',
  accent: '#EBB65C',
  accentSoft: 'rgba(235,182,92,0.20)',
  paid: '#93B183',
  warning: '#E7B25A',
  warningLight: 'rgba(231,178,90,0.18)',
  danger: '#D98A63',
  dangerLight: 'rgba(217,138,99,0.16)',
  stoneInactive: 'rgba(241,232,216,0.44)',
  stoneLight: 'rgba(241,232,216,0.06)',
  stone700: 'rgba(241,232,216,0.70)',
  // not overridden in the evening theme — inherit day values
  terracotta: '#C97F5D',
  tabbar: 'rgba(26,22,19,0.66)',
  sheetScrim: 'rgba(0,0,0,0.55)',
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
