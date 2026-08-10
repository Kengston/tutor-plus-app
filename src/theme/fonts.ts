/**
 * Brand typography — Onest (весь UI) + Manrope display (вордмарк и героические цифры).
 * Дизайн-система v2 §6; механика подключения — резолюшн research-тикета #67.
 *
 * ПОЧЕМУ КАРТА «ВЕС → СЕМЕЙСТВО», а не одно семейство + fontWeight:
 * `@expo-google-fonts/*` ставит СТАТИЧНЫЕ .ttf — по одному файлу на начертание, и
 * регистрирует каждый под собственным именем (`Onest_600SemiBold`). Ни на нативе, ни
 * на вебе `fontWeight` не переключает лицо внутри такого семейства: натив возьмёт
 * зарегистрированное лицо как есть, браузер синтезирует фальшивый жир из Regular.
 * Поэтому вес выбирает СЕМЕЙСТВО — эта карта, — а `fontWeight` в стилях остаётся как
 * есть (он совпадает с реальным весом лица, так что синтеза не будет).
 *
 * Точка применения — `ui/Text` (и `ui/TextInput`): они подставляют семейство ПЕРЕД
 * пользовательским стилем, поэтому явный `fontFamily` (вордмарк, героическая цифра)
 * всегда побеждает.
 */
import type { TextStyle } from 'react-native';

import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
} from '@expo-google-fonts/onest';
import {
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

/** Имена семейств = ключи, под которыми шрифты регистрируются в `useFonts` ниже. */
export const fontFamilies = {
  onest400: 'Onest_400Regular',
  onest500: 'Onest_500Medium',
  onest600: 'Onest_600SemiBold',
  onest700: 'Onest_700Bold',
  manrope600: 'Manrope_600SemiBold',
  manrope700: 'Manrope_700Bold',
  manrope800: 'Manrope_800ExtraBold',
} as const;

/**
 * Карта для `useFonts` — вызывать СИНХРОННО на верхнем уровне корневого layout:
 * только тогда Expo Router при `expo export -p web` заинлайнит `@font-face` и
 * `<link rel="preload">` в HTML (research #67, вопрос 3). Внутри `useEffect`/async
 * оптимизация не срабатывает.
 */
export const brandFontMap = {
  [fontFamilies.onest400]: Onest_400Regular,
  [fontFamilies.onest500]: Onest_500Medium,
  [fontFamilies.onest600]: Onest_600SemiBold,
  [fontFamilies.onest700]: Onest_700Bold,
  [fontFamilies.manrope600]: Manrope_600SemiBold,
  [fontFamilies.manrope700]: Manrope_700Bold,
  [fontFamilies.manrope800]: Manrope_800ExtraBold,
};

/** Числовой вес → лицо Onest. Всё, что тяжелее 700, схлопывается в 700 (800/900 в UI не канон). */
const onestByWeight: Record<number, string> = {
  100: fontFamilies.onest400,
  200: fontFamilies.onest400,
  300: fontFamilies.onest400,
  400: fontFamilies.onest400,
  500: fontFamilies.onest500,
  600: fontFamilies.onest600,
  700: fontFamilies.onest700,
  800: fontFamilies.onest700,
  900: fontFamilies.onest700,
};

/** Числовой вес → лицо Manrope display (600–800 по канону §6). */
const manropeByWeight: Record<number, string> = {
  600: fontFamilies.manrope600,
  700: fontFamilies.manrope700,
  800: fontFamilies.manrope800,
};

/** `TextStyle['fontWeight']` → число. `normal` = 400, `bold` = 700, undefined = 400. */
function weightToNumber(weight: TextStyle['fontWeight']): number {
  if (weight == null || weight === 'normal') return 400;
  if (weight === 'bold') return 700;
  const n = typeof weight === 'number' ? weight : Number.parseInt(weight, 10);
  return Number.isFinite(n) ? Math.min(900, Math.max(100, Math.round(n / 100) * 100)) : 400;
}

/** Лицо Onest под вес стиля — базовое семейство любого текста интерфейса. */
export function onestFor(weight: TextStyle['fontWeight']): string {
  return onestByWeight[weightToNumber(weight)];
}

/**
 * Лицо Manrope под вес — для `display`-поверхностей: вордмарк и героические цифры.
 * Возвращает готовое значение `fontFamily`, которое ставится в стиль ЯВНО и потому
 * перебивает Onest, подставленный `ui/Text`.
 */
export function displayFor(weight: TextStyle['fontWeight'] = '700'): string {
  return manropeByWeight[weightToNumber(weight)] ?? fontFamilies.manrope700;
}
