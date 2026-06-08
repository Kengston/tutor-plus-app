/**
 * Sheet — bottom-sheet shell ported from the prototype (t+/kit.jsx `Sheet`).
 *
 * RN `Modal` (transparent) hosts an animated scrim (fade-in, `colors.sheetScrim`)
 * and a slide-up panel (reanimated `entering`), mirroring the prototype's
 * `om-rise` / `om-snack` keyframes. The panel has rounded top corners
 * (`radius.sheet`), a centred grab-handle, an optional title row with a close
 * button, and a scrollable body. Drag the handle down past a threshold — or tap
 * the scrim — to dismiss.
 */
import { useCallback, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { Icon } from './Icon';

export interface SheetProps {
  title?: string;
  onClose: () => void;
  children?: ReactNode;
  visible?: boolean;
}

/** Distance (px) the panel must be dragged down before it dismisses. */
const DISMISS_THRESHOLD = 90;
/** Velocity (px/s) that triggers a dismiss regardless of distance (a flick). */
const DISMISS_VELOCITY = 800;
/** Scrim fade-in matches the prototype's `om-rise .2s ease`. */
const SCRIM_FADE: WithTimingConfig = { duration: 200, easing: Easing.inOut(Easing.ease) };
/** Upward drop-shadow lifted verbatim from the prototype panel. */
const PANEL_SHADOW = '0px -10px 40px -12px rgba(0,0,0,0.3)';

export function Sheet({ title, onClose, children, visible = true }: SheetProps) {
  const { colors, radius } = useTheme();

  // Vertical drag offset for the panel (0 = resting, >0 = dragged down).
  const dragY = useSharedValue(0);

  const close = useCallback(() => {
    dragY.value = 0;
    onClose();
  }, [dragY, onClose]);

  // Panel: `om-snack` slide-up on mount; drag-down tracks the finger.
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  // Scrim fades opacity from 0→1 on mount (`om-rise`); tap dismisses.
  const scrimOpacity = useSharedValue(0);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const onScrimLayout = useCallback(() => {
    scrimOpacity.value = withTiming(1, SCRIM_FADE);
  }, [scrimOpacity]);

  const panGesture = Gesture.Pan()
    .onChange((e) => {
      // Only allow dragging downward; clamp upward pulls to the resting edge.
      dragY.value = Math.max(0, dragY.value + e.changeY);
    })
    .onEnd((e) => {
      if (dragY.value > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(close)();
      } else {
        dragY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
      }
    });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]} onLayout={onScrimLayout}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.sheetScrim }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(300).easing(Easing.bezier(0.22, 0.61, 0.36, 1))}
          style={[
            styles.sheet,
            panelStyle,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              boxShadow: PANEL_SHADOW,
            },
          ]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleZone}>
              <View style={[styles.grab, { backgroundColor: colors.hairline }]} />
            </View>
          </GestureDetector>

          {title ? (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.heading }]}>{title}</Text>
              <Pressable
                onPress={onClose}
                style={[styles.close, { backgroundColor: colors.stoneLight }]}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <Icon name="close" size={18} sw={2} stroke={colors.stone700} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22, maxHeight: '90%' },
  handleZone: { paddingVertical: 4, marginBottom: 10, alignItems: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 19, fontWeight: '600', letterSpacing: -0.3 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { flexGrow: 1 },
});

export default Sheet;
