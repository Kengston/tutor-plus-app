import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Line, Stop } from 'react-native-svg';

import { catColors, useTheme, type CatColor } from '@/theme';

export interface DayLaneItem {
  /** 0..1 position within [start, end]. */
  frac: number;
  cat?: CatColor;
  done?: boolean;
}

export interface DayLaneProps {
  start?: number;
  end?: number;
  items: DayLaneItem[];
  /** 0..1 position of the "now" marker. */
  nowFrac?: number;
}

/** Track geometry (matches the prototype: 30px-tall row, 4px bar at top:13). */
const LANE_HEIGHT = 30;
const TRACK_TOP = 13;
const TRACK_THICKNESS = 4;
const DOT_SIZE = 11;
const NOW_SIZE = 13;

/** Past-fill gradient — prototype hardcodes `accent → #E8B43C`. */
const FILL_GRADIENT_END = '#E8B43C';

const clamp01 = (f: number) => Math.min(Math.max(f, 0), 1);
const pct = (f: number) => `${clamp01(f) * 100}%` as const;

/**
 * DayLane — mini day timeline ported from t+/kit.jsx `DayLane`:
 * a rounded base track with a gradient past-fill up to `nowFrac`, lesson dots
 * positioned by `item.frac`, hour ticks every 3h, and a pulsing "now" marker.
 */
export function DayLane(props: DayLaneProps) {
  const { start = 9, end = 21, items, nowFrac = 0.5 } = props;
  const { colors, shadow } = useTheme();

  const ticks: number[] = [];
  for (let h = start; h <= end; h += 3) ticks.push(h);

  // Pulsing "now" marker — mirrors the `om-pulse` keyframes
  // (scale 1→1.12, opacity 1→.82, 1.8s ease-in-out, infinite alternate).
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 1 - pulse.value * 0.18,
  }));

  const nowPct = pct(nowFrac);

  return (
    <View style={styles.root}>
      <View style={styles.lane}>
        {/* base track + gradient past-fill (SVG for crisp rounded caps + gradient) */}
        <Svg
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
          width="100%"
          height={LANE_HEIGHT}>
          <Defs>
            <LinearGradient id="dayLanePast" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={colors.accent} />
              <Stop offset="100%" stopColor={FILL_GRADIENT_END} />
            </LinearGradient>
          </Defs>
          <Line
            x1={0}
            y1={TRACK_TOP + TRACK_THICKNESS / 2}
            x2="100%"
            y2={TRACK_TOP + TRACK_THICKNESS / 2}
            stroke={colors.stoneLight}
            strokeWidth={TRACK_THICKNESS}
            strokeLinecap="round"
          />
          {clamp01(nowFrac) > 0 ? (
            <Line
              x1={0}
              y1={TRACK_TOP + TRACK_THICKNESS / 2}
              x2={nowPct}
              y2={TRACK_TOP + TRACK_THICKNESS / 2}
              stroke="url(#dayLanePast)"
              strokeWidth={TRACK_THICKNESS}
              strokeLinecap="round"
            />
          ) : null}
        </Svg>

        {/* lesson dots */}
        {items.map((it, i) => {
          const accent = it.cat ? catColors[it.cat].accent : colors.accent;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  left: pct(it.frac),
                  backgroundColor: it.done ? accent : colors.surface,
                  borderColor: accent,
                  // 2px halo separating the dot from the track (prototype boxShadow).
                  boxShadow: `0 0 0 2px ${colors.surface}`,
                  pointerEvents: 'none',
                },
              ]}
            />
          );
        })}

        {/* now marker */}
        <Animated.View
          style={[
            styles.now,
            { left: nowPct, pointerEvents: 'none' },
            {
              backgroundColor: colors.accent,
              borderColor: colors.surface,
              boxShadow: shadow.marker,
            },
            pulseStyle,
          ]}
        />
      </View>

      <View style={styles.ticks}>
        {ticks.map((h) => (
          <Text key={h} style={[styles.tick, { color: colors.muted }]}>
            {h}:00
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  lane: {
    position: 'relative',
    height: LANE_HEIGHT,
  },
  dot: {
    position: 'absolute',
    top: 15,
    width: DOT_SIZE,
    height: DOT_SIZE,
    // centre on `left` (prototype translate(-50%,-50%)): half size up/left.
    marginLeft: -DOT_SIZE / 2,
    marginTop: -DOT_SIZE / 2,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2.5,
  },
  now: {
    position: 'absolute',
    top: 15,
    width: NOW_SIZE,
    height: NOW_SIZE,
    // centre on the track line (prototype translate(-50%,-50%)): half size up/left.
    marginLeft: -NOW_SIZE / 2,
    marginTop: -NOW_SIZE / 2,
    borderRadius: NOW_SIZE / 2,
    borderWidth: 3,
  },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tick: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});

export default DayLane;
