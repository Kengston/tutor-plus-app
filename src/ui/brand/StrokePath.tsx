/**
 * `StrokePath` — один рукописный штрих, который умеет РИСОВАТЬСЯ (слайс #73 спеки #68).
 * Внутренняя деталь брендового слоя: наружу торчат `PlusStroke` / `CheckStroke`.
 *
 * Механика — `strokeDasharray` + `strokeDashoffset` СТРОГО ПАРОЙ: нативное извлечение
 * react-native-svg обнуляет offset, если dasharray не задан (`extractStroke.ts`), поэтому
 * оба пропа всегда уезжают в одном `useAnimatedProps` (резолюшн #67 вопрос 1).
 *
 * ИНВАРИАНТ РЕПО «анимация — не единственный путь в рабочее состояние» соблюдён тем же
 * приёмом, что и вход шита (см. заголовок `ui/Sheet`): конечное состояние включает ТАЙМЕР,
 * а не колбэк анимации. `requestAnimationFrame` глохнет в фоновой вкладке и на свёрнутом
 * приложении — `setTimeout` продолжает тикать, и по дедлайну штрих просто перерисовывается
 * обычным `<Path>` без dash-пропов, то есть заведомо дорисованным.
 */
import { useEffect, useState } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Path } from 'react-native-svg';

import { type StrokeGeometry } from './glyph';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Кривая эталона (`cubic-bezier(.22,.61,.36,1)`) — то же ускорение, что у входа шита. */
const DRAW_EASING = Easing.bezier(0.22, 0.61, 0.36, 1);

/** Запас к дедлайну: анимация давно кончилась, штрих переходит в статику. */
const DEADLINE_SLACK_MS = 120;

export interface StrokePathProps {
  geometry: StrokeGeometry;
  color: string;
  strokeWidth: number;
  /** Рисовать штрих. `false` → сразу конечное состояние (в т.ч. при reduced-motion). */
  animate: boolean;
  durationMs: number;
  delayMs?: number;
  /** Смена значения перезапускает рисование (ключ перезапуска жеста). */
  drawKey?: string | number;
  strokeLinejoin?: 'round' | 'miter' | 'bevel';
}

export function StrokePath({
  geometry,
  color,
  strokeWidth,
  animate,
  durationMs,
  delayMs = 0,
  drawKey,
  strokeLinejoin,
}: StrokePathProps) {
  // Доля НЕнарисованного: 1 — штриха не видно, 0 — дорисован.
  const hidden = useSharedValue(animate ? 1 : 0);
  // Окно рисования закрыто. Переключается ТОЛЬКО таймером; обратно в false — через
  // cleanup эффекта (перезапуск по `drawKey`), как у входа шита.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!animate) {
      hidden.value = 0;
      return;
    }
    hidden.value = 1;
    hidden.value = withDelay(delayMs, withTiming(0, { duration: durationMs, easing: DRAW_EASING }));
    const deadline = setTimeout(() => setSettled(true), delayMs + durationMs + DEADLINE_SLACK_MS);
    return () => {
      clearTimeout(deadline);
      // Перевзвод под следующий прогон: штрих снова должен начинать с нуля.
      setSettled(false);
      hidden.value = 1;
    };
  }, [animate, drawKey, delayMs, durationMs, hidden]);

  const animatedProps = useAnimatedProps(() => ({
    // Оба пропа вместе — иначе нативная сторона обнулит offset.
    strokeDasharray: [geometry.length, geometry.length],
    strokeDashoffset: geometry.length * hidden.value,
  }));

  // Статика — и когда анимация не нужна вовсе, и когда дедлайн её закрыл.
  if (!animate || settled) {
    return (
      <Path
        d={geometry.d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin={strokeLinejoin}
        fill="none"
      />
    );
  }

  return (
    <AnimatedPath
      d={geometry.d}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin={strokeLinejoin}
      fill="none"
      animatedProps={animatedProps}
    />
  );
}
