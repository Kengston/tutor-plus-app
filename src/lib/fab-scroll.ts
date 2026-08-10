/**
 * Скрытие FAB по скроллу (слайс #75 спеки #68) — ЧИСТАЯ функция перехода состояния.
 *
 * Логика вынесена из компонента намеренно: это единственная часть жеста, у которой есть
 * внешне наблюдаемое поведение, не завязанное на кадры и рендер, — значит, её можно и нужно
 * проверить юнитом, а не глазами.
 *
 * Правила:
 *  1. У верха списка кнопка ВСЕГДА видна — там прятать нечего, а «пропавший плюс» на первом
 *     экране читается как поломка.
 *  2. Направление меняет видимость только после порога: без него дрожание пальца и
 *     resize-скачки на вебе дёргали бы кнопку туда-сюда.
 *  3. Движение меньше порога НЕ обновляет опорную точку — иначе медленный скролл никогда бы
 *     не накопил порог и кнопка не пряталась вовсе.
 */

export interface FabScrollState {
  visible: boolean;
  /** Опорное смещение, от которого считается направление. */
  lastY: number;
}

/** Зона у верха списка, где кнопка не прячется, px. */
export const FAB_TOP_ZONE = 24;
/** Порог смены направления, px. */
export const FAB_SCROLL_THRESHOLD = 8;

export const initialFabScrollState: FabScrollState = { visible: true, lastY: 0 };

export function nextFabScrollState(state: FabScrollState, offsetY: number): FabScrollState {
  // Отрицательное смещение — это оверскролл-«резинка», для направления она не считается.
  const y = Math.max(0, offsetY);

  if (y <= FAB_TOP_ZONE) {
    return state.visible && state.lastY === y ? state : { visible: true, lastY: y };
  }

  const delta = y - state.lastY;
  if (Math.abs(delta) < FAB_SCROLL_THRESHOLD) return state;

  const visible = delta < 0;
  return visible === state.visible && state.lastY === y ? state : { visible, lastY: y };
}
