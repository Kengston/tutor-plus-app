/**
 * `PlusStroke` — рукописный плюс-росчерк бренда (слайс #73 спеки #68).
 *
 * ЕДИНСТВЕННЫЙ способ нарисовать фирменный плюс: вручную его не рисуют нигде.
 * Рукописный слой разрешён только в трёх зонах (дизайн-система v2 §10): жест «добавить»,
 * логотип, иллюстрации пустых состояний и онбординга. Плюсы в деньгах («+1 500 ₽») —
 * всегда типографские, этот компонент туда не ставят.
 *
 * Порядок рисования канона: сначала вертикаль, следом — горизонталь. Обе фазы
 * укладываются ровно в моушн-токен `standard` (250 мс), деля его в пропорции эталона.
 */
import Svg, { G } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/theme';

import { GLYPH_VIEWBOX, PLUS_GLYPHS, VERTICAL_SHARE, type PlusSize } from './glyph';
import { StrokePath } from './StrokePath';

export interface PlusStrokeProps {
  size?: PlusSize;
  /** Сторона квадрата в px. */
  px?: number;
  /** Цвет росчерка. По умолчанию — бренд-янтарь темы. */
  color?: string;
  animated?: boolean;
  /** Смена значения перезапускает рисование. */
  drawKey?: string | number;
}

export function PlusStroke({ size = 'marker', px = 24, color, animated = false, drawKey }: PlusStrokeProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const glyph = PLUS_GLYPHS[size];
  // При уменьшенном движении элемент появляется сразу в конечном состоянии.
  const animate = animated && !reduced;
  const verticalMs = Math.round(motion.standard * VERTICAL_SHARE);
  const horizontalMs = motion.standard - verticalMs;

  return (
    <Svg width={px} height={px} viewBox={GLYPH_VIEWBOX} fill="none">
      {/* Лёгкий внутренний отступ канона: знак не упирается в края квадрата. */}
      <G transform="translate(50,50) scale(0.9) translate(-50,-50)">
        <StrokePath
          geometry={glyph.v}
          color={color ?? colors.accent}
          strokeWidth={glyph.sw}
          animate={animate}
          durationMs={verticalMs}
          drawKey={drawKey}
        />
        <StrokePath
          geometry={glyph.h}
          color={color ?? colors.accent}
          strokeWidth={glyph.sw}
          animate={animate}
          durationMs={horizontalMs}
          delayMs={verticalMs}
          drawKey={drawKey}
        />
      </G>
    </Svg>
  );
}

export default PlusStroke;
