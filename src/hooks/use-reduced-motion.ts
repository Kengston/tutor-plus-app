/**
 * `useReducedMotion()` — единый кроссплатформенный флаг уменьшенного движения
 * (слайс #71 спеки #68). Механика и обоснование «без веток по платформе» — в
 * `lib/reduced-motion`.
 *
 * Потребители используют его как ВЫКЛЮЧАТЕЛЬ анимации, а не как условие показа:
 * по инварианту репо анимация никогда не единственный путь в рабочее состояние —
 * при `true` элемент рисуется сразу в конечном виде.
 */
import { useSyncExternalStore } from 'react';

import { getReducedMotion, subscribeReducedMotion } from '@/lib/reduced-motion';

export function useReducedMotion(): boolean {
  // Третий аргумент — снапшот для серверного/статического рендера (`expo export -p web`):
  // там системного состояния нет, поэтому считаем движение разрешённым, а реальное
  // значение приезжает на клиенте после гидрации.
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}

export default useReducedMotion;
