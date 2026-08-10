/**
 * `MarginMark` — «пометки на полях», семь видов (слайс #74 спеки #68).
 *
 * Это ЕДИНСТВЕННЫЕ разрешённые рукописные иллюстрации: стоковых картинок в продукте нет
 * (дизайн-система v2 §8 «Пустые состояния», §10 «Дозировка»). Рукописный слой живёт ровно
 * в трёх зонах — жест «добавить», логотип, иллюстрации пустых состояний и онбординга.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/theme';

import {
  CHECK_STROKE,
  CHECK_STROKE_WIDTH,
  GLYPH_VIEWBOX,
  HIGHLIGHT_RECT,
  MARGIN_STROKE_WIDTH,
  MARGIN_STROKES,
  PLUS_GLYPHS,
  VERTICAL_SHARE,
} from './glyph';
import { PlusStroke } from './PlusStroke';
import { StrokePath } from './StrokePath';
import { Text } from '../Text';

export type MarginMarkKind =
  | 'plus_pen'
  | 'plus_double'
  | 'check'
  | 'underline'
  | 'wave'
  | 'circle_date'
  | 'highlight';

/** Все виды пометок — для витрины кита и для перебора в тестах. */
export const MARGIN_MARK_KINDS: MarginMarkKind[] = [
  'plus_pen',
  'plus_double',
  'check',
  'underline',
  'wave',
  'circle_date',
  'highlight',
];

export interface MarginMarkProps {
  kind?: MarginMarkKind;
  px?: number;
  color?: string;
  /** Число в кружке — только для `circle_date`. */
  date?: number | string;
  animated?: boolean;
  drawKey?: string | number;
}

export function MarginMark({
  kind = 'plus_pen',
  px = 72,
  color,
  date,
  animated = true,
  drawKey,
}: MarginMarkProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const ink = color ?? colors.accent;
  const animate = animated && !reduced;

  if (kind === 'plus_pen') {
    return <PlusStroke size="pen" px={px} color={ink} animated={animated} drawKey={drawKey} />;
  }

  if (kind === 'plus_double') {
    // Два микро-плюса вразнобой — «пометка на полях», а не второй логотип.
    const glyph = PLUS_GLYPHS.micro;
    // Тот же порядок руки, что у `PlusStroke` и у канона: вертикаль, следом горизонталь.
    // Обе фазы делят токен `standard` в пропорции эталона — иначе двойной плюс рисуется
    // «другой рукой», чем все остальные росчерки ветки.
    const verticalMs = Math.round(motion.standard * VERTICAL_SHARE);
    const pair = (transform: string, key: string) => (
      <G key={key} transform={transform}>
        <StrokePath
          geometry={glyph.v}
          color={ink}
          strokeWidth={glyph.sw}
          animate={animate}
          durationMs={verticalMs}
          drawKey={drawKey}
        />
        <StrokePath
          geometry={glyph.h}
          color={ink}
          strokeWidth={glyph.sw}
          animate={animate}
          durationMs={motion.standard - verticalMs}
          delayMs={verticalMs}
          drawKey={drawKey}
        />
      </G>
    );
    return (
      <Svg width={px} height={px} viewBox={GLYPH_VIEWBOX} fill="none">
        {pair('translate(34,56) scale(0.34) translate(-50,-50)', 'small')}
        {pair('translate(62,42) scale(0.44) translate(-50,-50)', 'big')}
      </Svg>
    );
  }

  if (kind === 'check') {
    return <CheckMark px={px} ink={ink} animate={animate} durationMs={motion.standard} drawKey={drawKey} />;
  }

  if (kind === 'highlight') {
    // Единственная пометка без штриха: маркерная заливка не «рисуется».
    return (
      <Svg width={px} height={px} viewBox={GLYPH_VIEWBOX} fill="none">
        <Rect
          x={HIGHLIGHT_RECT.x}
          y={HIGHLIGHT_RECT.y}
          width={HIGHLIGHT_RECT.width}
          height={HIGHLIGHT_RECT.height}
          rx={HIGHLIGHT_RECT.rx}
          fill={ink}
          opacity={HIGHLIGHT_RECT.opacity}
          transform={`rotate(${HIGHLIGHT_RECT.rotate} 50 50)`}
        />
      </Svg>
    );
  }

  if (kind === 'circle_date') {
    return (
      <View style={[styles.circleWrap, { width: px, height: px }]}>
        <Svg width={px} height={px} viewBox={GLYPH_VIEWBOX} fill="none">
          <StrokePath
            geometry={MARGIN_STROKES.circleDate}
            color={ink}
            strokeWidth={MARGIN_STROKE_WIDTH.circleDate}
            animate={animate}
            durationMs={motion.standard}
            drawKey={drawKey}
          />
        </Svg>
        {date != null ? (
          <Text style={[styles.date, { fontSize: px * 0.24, color: colors.heading }]}>{date}</Text>
        ) : null}
      </View>
    );
  }

  const stroke = kind === 'underline' ? MARGIN_STROKES.underline : MARGIN_STROKES.wave;
  const width = kind === 'underline' ? MARGIN_STROKE_WIDTH.underline : MARGIN_STROKE_WIDTH.wave;
  return (
    <Svg width={px} height={px} viewBox={GLYPH_VIEWBOX} fill="none">
      <StrokePath
        geometry={stroke}
        color={ink}
        strokeWidth={width}
        animate={animate}
        durationMs={motion.standard}
        drawKey={drawKey}
      />
    </Svg>
  );
}

/** Галочка внутри пометок берёт ту же геометрию, что и `CheckStroke` кита. */
function CheckMark({
  px,
  ink,
  animate,
  durationMs,
  drawKey,
}: {
  px: number;
  ink: string;
  animate: boolean;
  durationMs: number;
  drawKey?: string | number;
}) {
  return (
    <Svg width={px} height={px} viewBox={GLYPH_VIEWBOX} fill="none">
      <StrokePath
        geometry={CHECK_STROKE}
        color={ink}
        strokeWidth={CHECK_STROKE_WIDTH}
        animate={animate}
        durationMs={durationMs}
        drawKey={drawKey}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  circleWrap: { alignItems: 'center', justifyContent: 'center' },
  date: { position: 'absolute', fontWeight: '600' },
});

export default MarginMark;
