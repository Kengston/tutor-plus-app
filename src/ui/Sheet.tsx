/**
 * Sheet — bottom-sheet shell ported from the prototype (t+/kit.jsx `Sheet`).
 *
 * RN `Modal` (transparent) hosts an animated scrim (fade-in, `colors.sheetScrim`)
 * and a slide-up panel, mirroring the prototype's `om-rise` / `om-snack` keyframes.
 * The panel has rounded top corners (`radius.sheet`), a centred grab-handle, an
 * optional title row with a close button, and a scrollable body. Drag the handle
 * down past a threshold — or tap the scrim — to dismiss.
 *
 * WHY the entry is NOT reanimated's `entering={SlideInDown}` (TP-FIX-0719, пп. 2/3/5):
 * that layout animation parks the panel below the viewport and only the frame loop
 * brings it back — and the frame loop stops whenever the tab/app is backgrounded
 * (`requestAnimationFrame` is throttled to nothing). A sheet opened in that state stayed
 * off-screen (measured: `translateY(613px)`, scrim at `opacity 0.069`) while its
 * full-screen scrim kept swallowing every tap — the app looked frozen.
 *
 * So the entry here is a plain shared value that a TIMER can overrule: `setTimeout` keeps
 * firing when `requestAnimationFrame` does not, and past the deadline the panel switches to
 * a drag-only style that puts it at rest. Nothing on that path waits for a frame — notably
 * NOT the measured panel height (`onLayout` rides on ResizeObserver, delivered in the same
 * rendering step as rAF, so it starves together with it); the height only refines the travel
 * distance, and `FALLBACK_TRAVEL` covers the window before it arrives.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';

import { useT } from '@/i18n';
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
/** Slide-up duration — the prototype's `om-snack .3s`. */
const ENTER_MS = 300;
const ENTER_TIMING: WithTimingConfig = { duration: ENTER_MS, easing: Easing.bezier(0.22, 0.61, 0.36, 1) };
/** Scrim fade-in matches the prototype's `om-rise .2s ease`. */
const SCRIM_FADE: WithTimingConfig = { duration: 200, easing: Easing.inOut(Easing.ease) };
/** By this point the entry is over, one way or another: a timer (which fires even when the
 *  frame loop does not) drops the sheet to its resting position. */
const ENTER_DEADLINE_MS = ENTER_MS + 250;
/** Travel distance before the panel has been measured. `onLayout` rides on ResizeObserver,
 *  which is delivered in the SAME rendering step as `requestAnimationFrame` — so in a
 *  backgrounded tab it starves too and the height never arrives. The entry therefore starts
 *  from this generous offset (off-screen on any phone-sized viewport) and refines to the
 *  real height as soon as layout lands; it is never a PRECONDITION for anything. */
const FALLBACK_TRAVEL = 720;

export function Sheet({ title, onClose, children, visible = true }: SheetProps) {
  const { colors, radius, shadow } = useTheme();
  const t = useT();

  // Vertical drag offset for the panel (0 = resting, >0 = dragged down).
  const dragY = useSharedValue(0);
  // Entry progress: 0 = one panel-height below the resting position, 1 = at rest.
  const enter = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);

  // Panel height, measured on first layout — the slide starts exactly one panel below the
  // rest position, so a two-row picker and a full-height list travel the same visual way.
  const [panelH, setPanelH] = useState(0);
  // Entry window is over: the panel drops the entry offset and keeps only the drag offset.
  // Flipped by a TIMER, never by the animation's own callback — the whole point is to be
  // independent of frames (see the file header).
  const [settled, setSettled] = useState(false);

  const close = useCallback(() => {
    dragY.value = 0;
    onClose();
  }, [dragY, onClose]);

  // Entry runs per OPEN, not per mount: sheets with a `visible` prop (DateTimePickerSheet,
  // PeriodSheet, the students sort) stay mounted and only toggle.
  useEffect(() => {
    if (!visible) return;
    enter.value = 0;
    scrimOpacity.value = 0;
    enter.value = withTiming(1, ENTER_TIMING);
    scrimOpacity.value = withTiming(1, SCRIM_FADE);
    const deadline = setTimeout(() => setSettled(true), ENTER_DEADLINE_MS);
    return () => {
      clearTimeout(deadline);
      // Re-arm for the next open: the panel must start below the viewport again, and the
      // entry animation must be allowed to play instead of snapping straight to rest.
      setSettled(false);
      enter.value = 0;
      scrimOpacity.value = 0;
    };
    // `panelH` restarts the entry once the real travel distance is known (it lands within
    // the first rendering step, so the restart is invisible).
  }, [visible, panelH, enter, scrimOpacity]);

  // Entry: the panel sits `travel` below its resting position and rides up. Also carries the
  // live drag offset, so a drag during the entry still tracks the finger.
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value + (1 - enter.value) * (panelH || FALLBACK_TRAVEL) }],
  }));

  // Post-entry: drag only. Reanimated recomputes an attached animated style on every React
  // render, so switching to this style lands the panel at rest WITHOUT needing a frame —
  // that is what rescues a sheet whose entry animation never ran.
  const restStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  // Scrim fades opacity from 0→1 on open (`om-rise`); tap dismisses. Same deal: once the
  // entry window is over it is simply opaque, no frames required.
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const scrimRest = { opacity: 1 } as const;

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
        <Animated.View style={[StyleSheet.absoluteFill, settled ? scrimRest : scrimStyle]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.sheetScrim }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
          />
        </Animated.View>

        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setPanelH((prev) => (prev === 0 ? h : prev));
          }}
          style={[
            styles.sheet,
            settled ? restStyle : panelStyle,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              boxShadow: shadow.sheet,
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
                accessibilityLabel={t('a11y.close')}>
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
