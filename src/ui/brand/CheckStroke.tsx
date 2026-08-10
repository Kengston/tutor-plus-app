/**
 * `CheckStroke` — рукописная галочка той же рукой, что и плюс-росчерк (слайс #73).
 *
 * Это спокойный «жест сделано» после создания: тон канона — инструмент после уроков,
 * а не праздничный SaaS, поэтому подтверждение рисуется, а не взрывается конфетти.
 */
import Svg from 'react-native-svg';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/theme';

import { CHECK_STROKE, CHECK_STROKE_WIDTH, GLYPH_VIEWBOX } from './glyph';
import { StrokePath } from './StrokePath';

export interface CheckStrokeProps {
  px?: number;
  color?: string;
  animated?: boolean;
  drawKey?: string | number;
}

export function CheckStroke({ px = 24, color, animated = true, drawKey }: CheckStrokeProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();

  return (
    <Svg width={px} height={px} viewBox={GLYPH_VIEWBOX} fill="none">
      <StrokePath
        geometry={CHECK_STROKE}
        color={color ?? colors.accent}
        strokeWidth={CHECK_STROKE_WIDTH}
        animate={animated && !reduced}
        durationMs={motion.standard}
        drawKey={drawKey}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default CheckStroke;
