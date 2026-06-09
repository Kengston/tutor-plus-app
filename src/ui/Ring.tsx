import { useEffect, useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Ring gradient stops are intentionally fixed brand colours (top-left → bottom-right),
// independent of light/dark theme — matched from the prototype.
const GRAD_FROM = '#FFE6A6';
const GRAD_MID = '#FFD364';
const GRAD_TO = '#E8B43C';

const FILL_DURATION = 1000;

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
  }, [fill, run, target]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - fill.value),
  }));

  // Unique, deterministic gradient id per instance (SSR-safe under react-native-web).
  const gradId = `ring-grad-${useId()}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={GRAD_FROM} />
            <Stop offset="55%" stopColor={GRAD_MID} />
            <Stop offset="100%" stopColor={GRAD_TO} />
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
            animatedProps={animatedProps}
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
