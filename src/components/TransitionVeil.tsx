/**
 * Переходная заставка при входе (слайс #77 спеки #68) — короткая «вуаль» цвета фона с
 * анимированной плиткой приложения, чтобы переход из auth в приложение читался фирменным
 * жестом, а не миганием.
 *
 * Триггер — САМО МОНТИРОВАНИЕ, а монтирует её корневой layout по счётчику ВХОДОВ
 * (`useAuth().entryCount`), а не по наличию сессии. Разница принципиальная: `signedIn`
 * персистится и приезжает из `ProfileGate` до монтирования дерева, поэтому «сессия есть»
 * истинно на первом рендере КАЖДОГО запуска — по этому признаку вуаль накрывала бы уже
 * готовый экран на каждом старте (и давала бы на нативе двойной сплэш поверх
 * `expo-splash-screen`). Канон запускает вуаль только из перехода auth→app.
 *
 * ЭТО САМЫЙ ОПАСНЫЙ ЭЛЕМЕНТ БРЕНД-СЛОЯ: пока заставка на экране, приложения не видно.
 * Поэтому её уход держит ТОЛЬКО таймер — ни колбэк анимации, ни `onLayout`, ни кадр.
 * `requestAnimationFrame` глохнет в фоновой вкладке (в этом репозитории это уже роняло вход
 * шита и снекбар, см. заголовки `ui/Sheet` и `ui/Snackbar`), а `setTimeout` продолжает
 * тикать — значит вуаль гарантированно уходит и без единого кадра.
 *
 * При включённом уменьшенном движении заставки нет вовсе: её конечное состояние — «экран
 * приложения», и держать 700 мс статичную картинку вместо анимации было бы не уважением
 * настройки, а просто задержкой.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/theme';
import { AppPlate } from '@/ui';

/** Сколько живёт заставка: росчерк плитки рисуется за `standard`, остальное — на вдох. */
const VEIL_MS = 700;

export function TransitionVeil() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  // Взводится ТОЛЬКО таймером; в тело эффекта состояние не пишется.
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setExpired(true), VEIL_MS);
    return () => clearTimeout(timer);
  }, [reduced]);

  if (reduced || expired) return null;

  return (
    <View pointerEvents="none" style={[styles.veil, { backgroundColor: colors.bg }]}>
      <AppPlate px={64} animated />
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { position: 'absolute', inset: 0, zIndex: 999, alignItems: 'center', justifyContent: 'center' },
});

export default TransitionVeil;
