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
  radius: { card: number; sheet: number; control: number; pill: number };
  /** Cross-platform boxShadow string (RN 0.85+ supports `boxShadow`). */
  shadow: { card: string };
}

export const lightColors: ColorTokens = {
  bg: '#F7F1E3',
  surface: '#FFFDF7',
  elev: '#FFFFFF',
  heading: '#151E2D',
  body: 'rgba(21,30,45,0.80)',
  muted: 'rgba(21,30,45,0.55)',
  label3: 'rgba(21,30,45,0.30)',
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
  tabbar: 'rgba(247,241,227,0.78)',
  sheetScrim: 'rgba(21,30,45,0.34)',
  catTerracotta: '#9A4B28',
  catSlate: '#3D566D',
  catOchre: '#7B6328',
  catSage: '#3F5C49',
  catRose: '#7B4555',
  catLavender: '#534A75',
};

export const darkColors: ColorTokens = {
  bg: '#13161D',
  surface: '#1C212B',
  elev: '#222937',
  heading: '#F3ECDD',
  body: 'rgba(243,236,221,0.82)',
  muted: 'rgba(243,236,221,0.60)',
  label3: 'rgba(243,236,221,0.32)',
  hairline: 'rgba(243,236,221,0.10)',
  primary: '#FFD364',
  onTint: '#1B1407',
  primaryLight: 'rgba(255,211,100,0.20)',
  primaryVlight: 'rgba(243,236,221,0.06)',
  primaryDeep: '#FFD364',
  accent: '#FFD364',
  accentSoft: 'rgba(255,211,100,0.22)',
  paid: '#9CB87E',
  warning: '#E0A93A',
  warningLight: 'rgba(224,169,58,0.18)',
  danger: '#E08A6A',
  dangerLight: 'rgba(224,138,106,0.16)',
  stoneInactive: 'rgba(243,236,221,0.32)',
  stoneLight: 'rgba(243,236,221,0.06)',
  stone700: 'rgba(243,236,221,0.60)',
  // not overridden in the evening theme — inherit day values
  terracotta: '#C97F5D',
  tabbar: 'rgba(18,21,28,0.80)',
  sheetScrim: 'rgba(0,0,0,0.55)',
  catTerracotta: '#9A4B28',
  catSlate: '#3D566D',
  catOchre: '#7B6328',
  catSage: '#3F5C49',
  catRose: '#7B4555',
  catLavender: '#534A75',
};

const radius = { card: 22, sheet: 26, control: 12, pill: 999 } as const;

export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  radius,
  shadow: { card: '0px 12px 32px -22px rgba(0,0,0,0.18)' },
};

export const darkTheme: Theme = {
  scheme: 'dark',
  colors: darkColors,
  radius,
  shadow: { card: '0px 14px 34px -22px rgba(0,0,0,0.55)' },
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

/** Multi-series chart palette (`CHART_COLORS` in the prototype). */
export const chartColors = ['#7A95B0', '#C9899B', '#84A98C', '#C9A961', '#9B8FBE', '#C97F5D'] as const;
