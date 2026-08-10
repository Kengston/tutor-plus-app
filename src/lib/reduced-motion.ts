/**
 * Единый источник флага «уменьшенное движение» (слайс #71 спеки #68).
 *
 * ОДНА реализация на все платформы, без веток по `Platform.OS`: react-native-web 0.21 сам
 * реализует `AccessibilityInfo.isReduceMotionEnabled()` и подписку `reduceMotionChanged`
 * поверх `window.matchMedia('(prefers-reduced-motion: reduce)')` — отдельный web-путь с
 * ручным `matchMedia` был бы дублированием (резолюшн #67, вопрос 2).
 *
 * Почему store-модуль, а не хук с `useState`: снапшот нужен СИНХРОННО (`useSyncExternalStore`
 * в `hooks/use-reduced-motion`), а системное значение читается асинхронно. Модуль держит
 * последнее известное значение, поэтому второй и последующие потребители получают его
 * мгновенно, а не начинают с `false` каждый заново. Побочный эффект — эта логика
 * тестируется юнитом без рендера дерева.
 */
import { AccessibilityInfo } from 'react-native';

type Listener = (enabled: boolean) => void;

let enabled = false;
let started = false;
const listeners = new Set<Listener>();

function publish(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  for (const listener of listeners) listener(enabled);
}

/**
 * Первое чтение + подписка на системное изменение. Запускается один раз за жизнь процесса
 * и НЕ снимается: подписка стоит копейки, а её пересоздание на каждом монтировании роняло
 * бы значение обратно в `false` между экранами.
 */
function startOnce(): void {
  if (started) return;
  started = true;
  void AccessibilityInfo.isReduceMotionEnabled()
    .then(publish)
    .catch(() => publish(false));
  AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
}

/** Подписка для `useSyncExternalStore`; возвращает отписку. */
export function subscribeReducedMotion(listener: Listener): () => void {
  startOnce();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Последнее известное значение. До первого асинхронного чтения — `false` (движение разрешено). */
export function getReducedMotion(): boolean {
  return enabled;
}

/** ТОЛЬКО для тестов: сбрасывает модульное состояние между кейсами. */
export function __resetReducedMotionForTests(): void {
  enabled = false;
  started = false;
  listeners.clear();
}
