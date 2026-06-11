import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

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
const DEFAULT_FG = '#fff';

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

  const snapTo = (to: number) => {
    'worklet';
    tx.value = withTiming(to, { duration: SNAP_DURATION, easing: SNAP_EASING });
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

  return (
    <View style={styles.container}>
      {leftActions.length > 0 && (
        <Panel actions={leftActions} side="left" unit={unit} onFire={fire} />
      )}
      {rightActions.length > 0 && (
        <Panel actions={rightActions} side="right" unit={unit} onFire={fire} />
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, { backgroundColor: colors.surface }, rowStyle]}>
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
  return (
    <View style={[styles.panel, side === 'left' ? styles.panelLeft : styles.panelRight]}>
      {actions.map((a, i) => {
        const fg = a.fg ?? DEFAULT_FG;
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
