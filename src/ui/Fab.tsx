/**
 * FAB — жест «добавить» (слайс #75 спеки #68).
 *
 * Внутри РУКОПИСНЫЙ росчерк, а не типографский плюс: это одна из трёх зон, где канон
 * разрешает рукописный слой (дизайн-система v2 §10).
 *
 * Кнопка прячется при прокрутке вниз и возвращается при прокрутке вверх. Решение о
 * видимости принимает чистая функция (`lib/fab-scroll`, покрыта юнитом), состояние приходит
 * из `Screen` через контекст — поэтому вызывающим экранам ничего менять не пришлось.
 *
 * ИНВАРИАНТ «анимация — не единственный путь в рабочее состояние»: рабочее состояние здесь
 * — ВИДИМАЯ кнопка, и добраться до неё без кадров обязательно. Поэтому за анимацией
 * ухода/возврата следит таймер: по дедлайну компонент переключается на плоский стиль
 * текущего состояния. Если кадров нет вовсе, кнопка просто мгновенно оказывается там, где
 * должна быть, вместо того чтобы застрять полупрозрачной и неотзывчивой.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

import { PlusStroke } from './brand';

/** Видимость FAB, посчитанная экраном по скроллу. Без провайдера кнопка всегда видна. */
const FabVisibilityContext = createContext(true);
export const FabVisibilityProvider = FabVisibilityContext.Provider;
export const useFabVisible = () => useContext(FabVisibilityContext);

/** Насколько кнопка уезжает вниз, скрываясь, px (эталон кита — 120). */
const HIDE_TRAVEL = 120;
/** Запас к дедлайну перехода. */
const DEADLINE_SLACK_MS = 120;

export interface FabProps {
  onPress: () => void;
  bottom?: number;
}

export function Fab({ onPress, bottom = 24 }: FabProps) {
  const { colors, shadow, motion } = useTheme();
  const reduced = useReducedMotion();
  const t = useT();
  const visible = useFabVisible();

  const shown = useSharedValue(1);
  // Переход завершён — дальше плоский стиль. Взводится ТАЙМЕРОМ, снимается в cleanup.
  const [settled, setSettled] = useState(true);

  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduced) {
      shown.value = target;
      return;
    }
    shown.value = withTiming(target, { duration: motion.standard });
    const deadline = setTimeout(() => setSettled(true), motion.standard + DEADLINE_SLACK_MS);
    return () => {
      clearTimeout(deadline);
      setSettled(false);
    };
  }, [visible, reduced, motion.standard, shown]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * HIDE_TRAVEL }],
  }));
  // Плоское состояние покоя — им же кнопка «доезжает», когда кадров нет.
  const restStyle = { opacity: visible ? 1 : 0, transform: [{ translateY: visible ? 0 : HIDE_TRAVEL }] };

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.wrap, { bottom }, reduced || settled ? restStyle : animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.add')}
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, boxShadow: shadow.fab },
          pressed ? styles.pressed : null,
        ]}>
        <PlusStroke size="marker" px={30} color={colors.onTint} animated />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 18, zIndex: 20 },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});

export default Fab;
