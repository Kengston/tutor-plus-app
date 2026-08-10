import { useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';

import { brandGradient, useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const FILL_DURATION = 1000;
/** By this point the fill is at rest one way or another — see the frame-safety note below. */
const FILL_DEADLINE_MS = FILL_DURATION + 80;

export interface RingProps {
  /** 0..1 progress. */
  progress?: number;
  size?: number;
  stroke?: number;
  centerTop?: ReactNode;
  centerSub?: ReactNode;
  color?: string;
  run?: boolean;
}

/**
 * Apple-Fitness progress ring — ported from t+/kit.jsx `Ring`: a stone track with a
 * gradient arc that animates from empty to `progress` on mount (ease-out, ~1s).
 */
export function Ring(props: RingProps) {
  const { progress = 0, size = 132, stroke = 13, centerTop, centerSub, run = true } = props;
  const { colors } = useTheme();

  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = Math.min(Math.max(progress, 0), 1);

  // Standard SVG ring fill: keep a full-circumference dash window and animate the
  // dash offset from `circ` (empty) down to `circ * (1 - target)` (filled). Driving
  // the offset on the UI thread keeps the fill smooth on web and native alike.
  const fill = useSharedValue(run ? 0 : target);

  // Frame-safety insurance (same pattern as ui/Snackbar, ui/Sheet — see their file headers):
  // the arc starts at `strokeDashoffset = circ` (fully empty) and only reaches its target via
  // `withTiming`, which rides on the frame loop. A backgrounded tab stalls that loop — with
  // zero frames delivered the ring would stay empty forever. `settled` is a TIMER's guarantee,
  // independent of frames, that the arc ends up at its target regardless. Triggered from the
  // effect (fires with or without frames), never from `onLayout` (rides on ResizeObserver,
  // which starves alongside `requestAnimationFrame`).
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (run) {
      fill.value = 0;
      fill.value = withTiming(target, {
        duration: FILL_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      fill.value = target;
    }
    const deadline = setTimeout(() => setSettled(true), FILL_DEADLINE_MS);
    // Re-arm on the NEXT run (progress/`run` change) or unmount — mirrors Sheet's re-arm in
    // its effect cleanup, not the body, so this isn't a synchronous setState-in-effect.
    return () => {
      clearTimeout(deadline);
      setSettled(false);
    };
  }, [fill, run, target]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - fill.value),
  }));
  // Flat fallback once `settled`: a plain prop, not a shared-value read, so it renders
  // correctly even if the animated path above never delivered a single frame.
  const restOffset = circ * (1 - target);

  // Unique, deterministic gradient id per instance (SSR-safe under react-native-web).
  const gradId = `ring-grad-${useId()}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={brandGradient.from} />
            <Stop offset="55%" stopColor={brandGradient.mid} />
            <Stop offset="100%" stopColor={brandGradient.to} />
          </LinearGradient>
        </Defs>
        {/* Rotate -90° via the SVG transform string (rotate about the centre) —
            NOT via originX/originY or Svg style.transform, both of which leak a
            `transform-origin` DOM attr that React 19 rejects on web. */}
        <G transform={`rotate(-90, ${size / 2}, ${size / 2})`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colors.stoneLight}
            strokeWidth={stroke}
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={[circ, circ]}
            {...(settled ? { strokeDashoffset: restOffset } : { animatedProps })}
          />
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center, { pointerEvents: 'none' }]}>
        {centerTop}
        {centerSub}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Ring;
