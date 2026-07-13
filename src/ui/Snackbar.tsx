/**
 * Snackbar — bottom confirmation bar ported from the prototype's global `SnackHost`
 * (t+2/components.jsx): inverted surface (`heading` bg / `bg` text), optional accent
 * action («Вернуть»/«Отменить»), `om-snack`-style slide-up on mount (entrance only,
 * as in the prototype — dismissal is instant). Presentational only — queueing/auto-
 * dismiss live in the `useSnack()` provider (lib/snack).
 *
 * The entrance uses the Sheet-scrim pattern (shared value + `withTiming` kicked off
 * in `onLayout`) rather than a layout-animation `entering` prop: reanimated's web
 * entering leaves the element `visibility:hidden` without ever attaching the
 * keyframes (observed on RNW; the Sheet scrim pattern renders correctly).
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

export interface SnackbarProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Offset from the host container's bottom — clears the tab bar (prototype: 108). */
  bottom?: number;
}

/** Prototype `om-snack .28s cubic-bezier(.22,.61,.36,1)` — rise + fade in. */
const ENTER: WithTimingConfig = { duration: 280, easing: Easing.bezier(0.22, 0.61, 0.36, 1) };
/** Slide-up distance of the entrance (px). */
const RISE = 14;

export function Snackbar({ message, actionLabel, onAction, bottom = 108 }: SnackbarProps) {
  const { colors, radius, shadow } = useTheme();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(RISE);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  // Kick the entrance off first layout (Sheet-scrim pattern) — runs once per mount;
  // the host re-mounts the bar per `show` via a monotonic key, replaying the rise.
  const onLayout = useCallback(() => {
    opacity.value = withTiming(1, ENTER);
    translateY.value = withTiming(0, ENTER);
  }, [opacity, translateY]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.bar,
        animatedStyle,
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
