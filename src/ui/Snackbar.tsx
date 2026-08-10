/**
 * Snackbar — bottom confirmation bar ported from the prototype's global `SnackHost`
 * (t+2/components.jsx): inverted surface (`heading` bg / `bg` text), optional accent
 * action («Вернуть»/«Отменить»), `om-snack`-style slide-up on mount (entrance only,
 * as in the prototype — dismissal is instant). Presentational only — queueing/auto-
 * dismiss live in the `useSnack()` provider (lib/snack).
 *
 * The entrance follows the same rule as `Sheet` (TP-FIX-0719, пп. 2/3/5): it must never be
 * the ONLY way the bar becomes visible. The bar starts transparent and 14px low, and both an
 * animation and a TIMER race to land it — because the frame loop stops whenever the tab/app
 * is backgrounded, and this bar carries «Вернуть». Measured before the fix, with zero frames
 * delivered: the snack mounted with the right text, stayed at `opacity: 0` for its whole life
 * and auto-dismissed 3.5 s later — the action reported nothing and its undo was unreachable.
 * (Its trigger used to be `onLayout`, which rides on ResizeObserver and starves along with
 * `requestAnimationFrame`, so the entrance did not even start.)
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { Text } from './Text';

export interface SnackbarProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Offset from the host container's bottom — clears the tab bar (prototype: 108). */
  bottom?: number;
}

/** Prototype `om-snack .28s cubic-bezier(.22,.61,.36,1)` — rise + fade in. */
const ENTER_MS = 280;
const ENTER: WithTimingConfig = { duration: ENTER_MS, easing: Easing.bezier(0.22, 0.61, 0.36, 1) };
/** Slide-up distance of the entrance (px). */
const RISE = 14;
/** By this point the bar is visible one way or another — a timer fires with or without frames. */
const ENTER_DEADLINE_MS = ENTER_MS + 120;
/** Flat resting style; plain values override whatever inline state the animation left behind. */
const REST = { opacity: 1, transform: [{ translateY: 0 }] } as const;

export function Snackbar({ message, actionLabel, onAction, bottom = 108 }: SnackbarProps) {
  const { colors, radius, shadow } = useTheme();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(RISE);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  // The entrance runs once per mount (the host re-mounts the bar per `show` via a monotonic
  // key) and starts in an EFFECT, which needs no frame to fire — unlike the previous
  // `onLayout` trigger. `settled` is the timer's guarantee that the bar ends up visible even
  // if not a single frame is ever painted.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    opacity.value = withTiming(1, ENTER);
    translateY.value = withTiming(0, ENTER);
    const deadline = setTimeout(() => setSettled(true), ENTER_DEADLINE_MS);
    return () => clearTimeout(deadline);
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.bar,
        settled ? REST : animatedStyle,
        { bottom, backgroundColor: colors.heading, borderRadius: radius.row, boxShadow: shadow.snack },
      ]}>
      <Text style={[styles.message, { color: colors.bg }]} numberOfLines={2}>
        {message}
      </Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={actionLabel}>
          {({ pressed }) => (
            <Text style={[styles.action, { color: colors.accent, opacity: pressed ? 0.7 : 1 }]}>{actionLabel}</Text>
          )}
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  message: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  action: { fontSize: 14.5, fontWeight: '600' },
});

export default Snackbar;
