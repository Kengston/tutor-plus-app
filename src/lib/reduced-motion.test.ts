/**
 * Флаг уменьшенного движения (слайс #71): проверяем ВНЕШНЕЕ поведение стора —
 * что он отдаёт подписчикам при включённом/выключенном системном режиме и что
 * реагирует на смену состояния на лету.
 *
 * `react-native` замокан целиком: в node-окружении настоящий пакет не грузится, а нам от
 * него нужен ровно один контракт — `AccessibilityInfo.isReduceMotionEnabled()` +
 * `addEventListener('reduceMotionChanged')`, возвращающий объект с `.remove()`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  initial: false,
  handler: undefined as ((v: boolean) => void) | undefined,
  removed: false,
};

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise.resolve(state.initial),
    addEventListener: (event: string, handler: (v: boolean) => void) => {
      if (event === 'reduceMotionChanged') state.handler = handler;
      return {
        remove: () => {
          state.removed = true;
        },
      };
    },
  },
}));

const load = async () => {
  vi.resetModules();
  const mod = await import('./reduced-motion');
  mod.__resetReducedMotionForTests();
  return mod;
};

beforeEach(() => {
  state.initial = false;
  state.handler = undefined;
  state.removed = false;
});

describe('стор уменьшенного движения', () => {
  it('система выключила режим — снапшот остаётся false', async () => {
    const { subscribeReducedMotion, getReducedMotion } = await load();
    const seen: boolean[] = [];
    subscribeReducedMotion((v) => seen.push(v));
    await Promise.resolve();
    expect(getReducedMotion()).toBe(false);
    expect(seen).toEqual([]); // значение не изменилось — подписчика не дёргаем
  });

  it('система включила режим — подписчик получает true, снапшот обновляется', async () => {
    state.initial = true;
    const { subscribeReducedMotion, getReducedMotion } = await load();
    const seen: boolean[] = [];
    subscribeReducedMotion((v) => seen.push(v));
    await Promise.resolve();
    await Promise.resolve();
    expect(getReducedMotion()).toBe(true);
    expect(seen).toEqual([true]);
  });

  it('смена системного состояния на лету доходит до всех подписчиков', async () => {
    const { subscribeReducedMotion, getReducedMotion } = await load();
    const a: boolean[] = [];
    const b: boolean[] = [];
    subscribeReducedMotion((v) => a.push(v));
    subscribeReducedMotion((v) => b.push(v));
    await Promise.resolve();

    state.handler?.(true);
    expect(getReducedMotion()).toBe(true);
    expect(a).toEqual([true]);
    expect(b).toEqual([true]);

    state.handler?.(false);
    expect(getReducedMotion()).toBe(false);
    expect(a).toEqual([true, false]);
  });

  it('отписка перестаёт получать события, остальные продолжают', async () => {
    const { subscribeReducedMotion } = await load();
    const a: boolean[] = [];
    const b: boolean[] = [];
    const off = subscribeReducedMotion((v) => a.push(v));
    subscribeReducedMotion((v) => b.push(v));
    await Promise.resolve();

    off();
    state.handler?.(true);
    expect(a).toEqual([]);
    expect(b).toEqual([true]);
  });

  it('системная подписка ставится один раз на все монтирования', async () => {
    const { subscribeReducedMotion } = await load();
    subscribeReducedMotion(() => {});
    const first = state.handler;
    expect(first).toBeTypeOf('function');
    subscribeReducedMotion(() => {});
    subscribeReducedMotion(() => {});
    expect(state.handler).toBe(first);
  });
});
