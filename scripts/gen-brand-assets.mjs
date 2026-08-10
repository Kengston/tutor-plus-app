/**
 * Рендер брендовых ассетов Tutor+ из зафиксированного глифа канона v4.1 (слайс #76 спеки #68).
 *
 *   node scripts/gen-brand-assets.mjs assets/images
 *
 * Expo НЕ рендерит SVG — на вход всех полей `app.json` нужен растровый PNG (резолюшн #67,
 * вопрос 4), поэтому знак растрируется headless-Chrome: он уже есть на машине разработчика и
 * не тянет в проект зависимость ради семи картинок.
 *
 * Ассеты — ВРЕМЯНКА до авторских макетов (запрос автору — тикет #59 карты #57). Скрипт живёт
 * в репозитории, чтобы происхождение картинок было воспроизводимым, а не «нарисовали руками
 * однажды»: геометрия здесь ровно та же, что в `src/ui/brand/glyph.ts`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.argv[2];
const TMP = join(process.env.TMPDIR || '/tmp', 'tp-assets');
mkdirSync(TMP, { recursive: true });

// ── Геометрия канона (viewBox 0 0 100 100), см. src/ui/brand/glyph.ts ──────────
const T_RECTS = `
  <rect x="18" y="20" width="64" height="14" rx="4.5" fill="__T__"/>
  <rect x="43" y="20" width="14" height="64" rx="4.5" fill="__T__"/>`;
const MARKER = {
  sw: 13,
  v: 'M 52.15 21.08 C 49.75 41.18, 47.76 61.31, 47.65 81.58',
  h: 'M 21.94 49.34 C 41.64 49.26, 61.29 47.94, 80.94 46.71',
};

/** Символ T⁺ в координатах 0..100 — трансформы группы взяты из `TSymbol`. */
const symbol = (tColor, plusColor) => `
  <g transform="translate(4,18) scale(0.78)">${T_RECTS.replaceAll('__T__', tColor)}</g>
  <g transform="translate(76,25) scale(0.36) translate(-50,-50)" fill="none"
     stroke="${plusColor}" stroke-width="${MARKER.sw}" stroke-linecap="round">
    <path d="${MARKER.v}"/>
    <path d="${MARKER.h}"/>
  </g>`;

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${body}</svg>`;

/**
 * ВИДИМЫЕ границы символа в его собственных координатах 0..100 — посчитаны по трансформам
 * групп и толщине штриха. Центрировать по коробке 100×100 нельзя: знак в ней сидит
 * несимметрично (T слева-внизу, плюс справа-вверху), и иконка уезжала бы из центра.
 */
const BOUNDS = { x: 18.04, y: 12.25, w: 71.46, h: 71.27 };

/** Символ, отмасштабированный так, чтобы ВИДИМАЯ часть заняла долю `cover` и легла в центр. */
const inset = (cover, tColor, plusColor) => {
  const k = (cover * 100) / Math.max(BOUNDS.w, BOUNDS.h);
  const tx = 50 - k * (BOUNDS.x + BOUNDS.w / 2);
  const ty = 50 - k * (BOUNDS.y + BOUNDS.h / 2);
  return `<g transform="translate(${tx.toFixed(3)},${ty.toFixed(3)}) scale(${k.toFixed(5)})">${symbol(tColor, plusColor)}</g>`;
};

const INK = '#151E2D';
const IVORY = '#FFFDF7';
const IVORY_EVENING = '#F3ECDD';
const AMBER = '#FFD364';

const assets = [
  // Иконка приложения: полный чернильный квадрат — скругление накладывает система.
  { file: 'icon.png', size: 1024, body: `<rect width="100" height="100" fill="${INK}"/>${inset(0.66, IVORY, AMBER)}` },
  // Android adaptive: знак обязан помещаться в безопасную зону 66/108 холста (≈0.611) —
  // Expo её не считает и не подрезает, поэтому берём 0.55 с запасом на маску и параллакс.
  { file: 'android-icon-foreground.png', size: 1024, body: inset(0.55, IVORY, AMBER), transparent: true },
  { file: 'android-icon-background.png', size: 1024, body: `<rect width="100" height="100" fill="${INK}"/>` },
  // Монохром для themed icons Android 13+: сплошной силуэт, систему красит сама.
  { file: 'android-icon-monochrome.png', size: 1024, body: inset(0.55, '#FFFFFF', '#FFFFFF'), transparent: true },
  // Favicon: плитка со скруглением запечена — вкладка не маскирует иконку сама.
  {
    file: 'favicon.png',
    size: 64,
    body: `<rect width="100" height="100" rx="27" fill="${INK}"/>${inset(0.62, IVORY, AMBER)}`,
  },
  // Сплэш: знак без подложки, цвет фона задаёт expo-splash-screen (день/вечер отдельно).
  { file: 'splash-icon.png', size: 1024, body: inset(0.94, INK, AMBER), transparent: true },
  { file: 'splash-icon-dark.png', size: 1024, body: inset(0.94, IVORY_EVENING, AMBER), transparent: true },
];

for (const a of assets) {
  const html = join(TMP, a.file.replace('.png', '.html'));
  writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:0">${svg(a.size, a.body)}</body>`,
  );
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--default-background-color=${a.transparent ? '00000000' : 'ffffffff'}`,
      `--window-size=${a.size},${a.size}`,
      `--screenshot=${join(OUT, a.file)}`,
      `file://${html}`,
    ],
    { stdio: 'ignore' },
  );
  console.log('rendered', a.file, a.size);
}
rmSync(TMP, { recursive: true, force: true });
