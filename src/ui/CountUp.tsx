import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

import { formatNumberRu } from '@/lib/format';

export interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  style?: TextStyle;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Ported from prototype t+/components.jsx `useCountUp` / `CountUp`:
 * animates 0→value with ease-out cubic over `duration` via a requestAnimationFrame loop.
 *
 * The loop is only the PRETTY path. `requestAnimationFrame` stops firing while the tab/app
 * sits in the background, which froze the headline on a partial sum — «Ожидают оплаты»
 * showed 548 ₽ / 630 ₽ instead of the real 6 000 ₽ and looked unstable between visits
 * (TP-FIX-0719, п. 1). Timers keep firing in that state, so one lands the final value
 * regardless of whether a single frame was ever painted.
 */
export function CountUp(props: CountUpProps) {
  const { value, format = formatNumberRu, duration = 1000, style } = props;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start: number | null = null;

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCurrent(value * easeOutCubic(p));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setCurrent(value);
      }
    };

    raf = requestAnimationFrame(tick);
    const settle = setTimeout(() => setCurrent(value), duration + 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [value, duration]);

  return <Text style={style}>{format(current)}</Text>;
}

export default CountUp;
