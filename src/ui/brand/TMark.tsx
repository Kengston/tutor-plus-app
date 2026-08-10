/**
 * Знаковый ряд бренда: строгая T + плюс-росчерк (слайс #74 спеки #68).
 *
 * `TMark`   — монограмма T⁺ в ширину: сплеш, шапки, маркетинг.
 * `TSymbol` — квадратный символ: иконка приложения, favicon, аватары. ≤20px — «микро».
 *
 * Геометрия (трансформы групп) перенесена из канона `kit.jsx` как есть.
 */
import Svg, { G, Rect } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/theme';

import {
  GLYPH_VIEWBOX,
  MICRO_THRESHOLD_PX,
  MONOGRAM_VIEWBOX,
  PLUS_GLYPHS,
  T_RECTS,
  type PlusGlyph,
} from './glyph';
import { StrokePath } from './StrokePath';

/** Доля токена `standard`, отданная вертикали (см. `PlusStroke`). */
const VERTICAL_SHARE = 0.44;

/** Прямоугольники строгой T — общая часть монограммы и символа. */
function TRects({ fill }: { fill: string }) {
  return (
    <>
      {T_RECTS.map((r) => (
        <Rect key={`${r.x}-${r.y}-${r.width}`} {...r} fill={fill} />
      ))}
    </>
  );
}

/** Плюс-росчерк внутри произвольной группы-трансформа знака. */
function GlyphStrokes({
  glyph,
  color,
  animate,
  standardMs,
  drawKey,
}: {
  glyph: PlusGlyph;
  color: string;
  animate: boolean;
  standardMs: number;
  drawKey?: string | number;
}) {
  const verticalMs = Math.round(standardMs * VERTICAL_SHARE);
  return (
    <>
      <StrokePath
        geometry={glyph.v}
        color={color}
        strokeWidth={glyph.sw}
        animate={animate}
        durationMs={verticalMs}
        drawKey={drawKey}
      />
      <StrokePath
        geometry={glyph.h}
        color={color}
        strokeWidth={glyph.sw}
        animate={animate}
        durationMs={standardMs - verticalMs}
        delayMs={verticalMs}
        drawKey={drawKey}
      />
    </>
  );
}

export interface TMarkProps {
  /** Высота знака в px; ширина — ×1.6. */
  px?: number;
  colorT?: string;
  colorPlus?: string;
  animated?: boolean;
  drawKey?: string | number;
}

export function TMark({ px = 64, colorT, colorPlus, animated = false, drawKey }: TMarkProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Svg width={px * 1.6} height={px} viewBox={MONOGRAM_VIEWBOX} fill="none">
      <TRects fill={colorT ?? colors.heading} />
      <G transform="translate(116,27) scale(0.52) translate(-50,-50)">
        <GlyphStrokes
          glyph={PLUS_GLYPHS.pen}
          color={colorPlus ?? colors.brandPlusInk}
          animate={animated && !reduced}
          standardMs={motion.standard}
          drawKey={drawKey}
        />
      </G>
    </Svg>
  );
}

export interface TSymbolProps {
  px?: number;
  colorT?: string;
  colorPlus?: string;
  animated?: boolean;
  drawKey?: string | number;
}

export function TSymbol({ px = 72, colorT, colorPlus, animated = false, drawKey }: TSymbolProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  // На микро-кегле знак перекладывается плотнее, иначе плюс теряется у края.
  const tiny = px <= MICRO_THRESHOLD_PX;
  const glyph = tiny ? PLUS_GLYPHS.micro : PLUS_GLYPHS.marker;

  return (
    <Svg width={px} height={px} viewBox={GLYPH_VIEWBOX} fill="none">
      <G transform={tiny ? 'translate(4,20) scale(0.76)' : 'translate(4,18) scale(0.78)'}>
        <TRects fill={colorT ?? colors.bg} />
      </G>
      <G
        transform={
          tiny ? 'translate(76,26) scale(0.42) translate(-50,-50)' : 'translate(76,25) scale(0.36) translate(-50,-50)'
        }>
        <GlyphStrokes
          glyph={glyph}
          color={colorPlus ?? colors.accent}
          animate={animated && !reduced}
          standardMs={motion.standard}
          drawKey={drawKey}
        />
      </G>
    </Svg>
  );
}
