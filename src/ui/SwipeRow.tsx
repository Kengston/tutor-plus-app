import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface SwipeAction {
  label: string;
  color: string;
  fg?: string;
  icon?: IconName;
  onPress: () => void;
}

export interface SwipeRowProps {
  children: ReactNode;
  /** Revealed by swiping right. */
  leftActions?: SwipeAction[];
  /** Revealed by swiping left. */
  rightActions?: SwipeAction[];
  unit?: number;
}

// Prototype snap transition: transform .26s cubic-bezier(.22,.61,.36,1).
const SNAP_DURATION = 260;
const SNAP_EASING = Easing.bezier(0.22, 0.61, 0.36, 1);
/** By this point a snap is at rest one way or another — see the frame-safety note below. */
const SNAP_DEADLINE_MS = SNAP_DURATION + 80;

/**
 * SwipeRow — swipe-to-reveal row, ported from the prototype t+/kit.jsx `SwipeRow`.
 * Pan drag drives translateX (clamped to the revealed action width); on release it
 * snaps fully open past unit*0.5, otherwise closed.
 */
export function SwipeRow({
  children,
  leftActions = [],
  rightActions = [],
  unit = 92,
}: SwipeRowProps) {
  const { colors } = useTheme();

  const maxR = rightActions.length * unit; // swipe left → reveal right actions
  const maxL = leftActions.length * unit; // swipe right → reveal left actions

  const tx = useSharedValue(0);
  const base = useSharedValue(0);

  // Frame-safety insurance (same pattern as ui/Snackbar, ui/Sheet — see their file headers):
  // `snapTo(0)` is the ONLY way a row closes (both the plain close and the reveal-then-fire
  // path below), and it only reaches its target via `withTiming`, which rides on the frame
  // loop. A backgrounded tab stalls that loop — with zero frames delivered the row would stay
  // snapped open, leaving its action panel visible and tappable underneath.
  //
  // `snapTarget` is set (via runOnJS, since `snapTo` also runs from the UI-thread gesture
  // worklet below) whenever a snap starts; the effect below arms a TIMER — independent of
  // frames — that lands `tx`/`settled` at that target regardless. `settled` then flips the row
  // to a flat, NEW-identity style, which Reanimated force-commits synchronously even without a
  // frame (see Sheet.tsx's comment on `ViewDescriptorsSet.add`). A fresh drag clears the target
  // (`onBegin`), which — through the effect's own cleanup, same as Sheet's re-arm — drops
  // `settled` so live tracking of `tx.value` resumes for the drag.
  const [snapTarget, setSnapTarget] = useState<number | null>(null);
  const [settled, setSettled] = useState<{ to: number } | null>(null);

  useEffect(() => {
    if (snapTarget == null) return;
    const deadline = setTimeout(() => {
      tx.value = snapTarget;
      setSettled({ to: snapTarget });
    }, SNAP_DEADLINE_MS);
    return () => {
      clearTimeout(deadline);
      setSettled(null);
    };
  }, [snapTarget, tx]);

  const snapTo = (to: number) => {
    'worklet';
    tx.value = withTiming(to, { duration: SNAP_DURATION, easing: SNAP_EASING });
    runOnJS(setSnapTarget)(to);
  };

  const close = () => {
    snapTo(0);
  };

  const fire = (fn: () => void) => {
    close();
    fn();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      base.value = tx.value;
      runOnJS(setSnapTarget)(null);
    })
    .onUpdate((e) => {
      const next = base.value + e.translationX;
      tx.value = Math.max(-maxR, Math.min(maxL, next));
    })
    .onEnd(() => {
      if (tx.value < -unit * 0.5 && maxR) snapTo(-maxR);
      else if (tx.value > unit * 0.5 && maxL) snapTo(maxL);
      else snapTo(0);
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  const restStyle = settled ? { transform: [{ translateX: settled.to }] } : null;

  return (
    <View style={styles.container}>
      {leftActions.length > 0 && (
        <Panel actions={leftActions} side="left" unit={unit} onFire={fire} />
      )}
      {rightActions.length > 0 && (
        <Panel actions={rightActions} side="right" unit={unit} onFire={fire} />
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, { backgroundColor: colors.surface }, restStyle ?? rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Panel({
  actions,
  side,
  unit,
  onFire,
}: {
  actions: SwipeAction[];
  side: 'left' | 'right';
  unit: number;
  onFire: (fn: () => void) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, side === 'left' ? styles.panelLeft : styles.panelRight]}>
      {actions.map((a, i) => {
        const fg = a.fg ?? colors.onTint;
        return (
          <Pressable
            key={i}
            onPress={() => onFire(a.onPress)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={[styles.action, { width: unit, backgroundColor: a.color }]}>
            {a.icon && <Icon name={a.icon} size={20} sw={1.9} stroke={fg} />}
            <Text style={[styles.label, { color: fg }]}>{a.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  row: {
    position: 'relative',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  panelLeft: {
    left: 0,
  },
  panelRight: {
    right: 0,
  },
  action: {
    height: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});

export default SwipeRow;
