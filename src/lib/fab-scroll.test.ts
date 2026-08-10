/**
 * Скрытие FAB по скроллу (слайс #75) — внешнее поведение чистой функции перехода.
 */
import { describe, expect, it } from 'vitest';

import {
  FAB_SCROLL_THRESHOLD,
  FAB_TOP_ZONE,
  initialFabScrollState,
  nextFabScrollState,
  type FabScrollState,
} from './fab-scroll';

/** Прогоняет последовательность смещений и отдаёт итоговое состояние. */
const run = (offsets: number[], from: FabScrollState = initialFabScrollState) =>
  offsets.reduce(nextFabScrollState, from);

describe('видимость FAB по скроллу', () => {
  it('в начале списка кнопка видна', () => {
    expect(initialFabScrollState.visible).toBe(true);
  });

  it('прокрутка вниз прячет кнопку', () => {
    expect(run([200]).visible).toBe(false);
  });

  it('прокрутка вверх возвращает кнопку', () => {
    expect(run([400, 300]).visible).toBe(true);
  });

  it('у верха списка кнопка видна всегда, даже если прокрутили вниз', () => {
    const scrolledDown = run([400]);
    expect(scrolledDown.visible).toBe(false);
    expect(nextFabScrollState(scrolledDown, FAB_TOP_ZONE).visible).toBe(true);
  });

  it('дрожание меньше порога не меняет видимость', () => {
    const down = run([400]);
    const jitter = run([400 + FAB_SCROLL_THRESHOLD - 1, 400 - FAB_SCROLL_THRESHOLD + 1], down);
    expect(jitter.visible).toBe(false);
    expect(jitter).toBe(down); // состояние не пересоздаётся — лишних ререндеров нет
  });

  it('медленный скролл накапливает порог и всё-таки прячет кнопку', () => {
    // Шаг заведомо меньше порога. Если бы опорная точка обновлялась на КАЖДОМ событии,
    // разница никогда не дошла бы до порога и кнопка осталась бы видимой навсегда.
    const step = FAB_SCROLL_THRESHOLD - 3;
    const base = 300;
    const slow = Array.from({ length: 5 }, (_, i) => base + step * (i + 1));
    const state = run(slow, { visible: true, lastY: base });
    expect(state.visible).toBe(false);
  });

  it('оверскролл-«резинка» (отрицательное смещение) не считается прокруткой вверх-вниз', () => {
    const top = nextFabScrollState(initialFabScrollState, -120);
    expect(top).toEqual({ visible: true, lastY: 0 });
  });

  it('смена направления работает в обе стороны подряд', () => {
    const seq = [0, 300, 600, 500, 700];
    const states = seq.map((_, i) => run(seq.slice(0, i + 1)));
    expect(states.map((s) => s.visible)).toEqual([true, false, false, true, false]);
  });
});
