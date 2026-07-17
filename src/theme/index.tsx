/**
 * Theme runtime — provider + hooks.
 *
 * `useTheme()`     → active design tokens (stable reference per scheme).
 * `useThemeMode()` → light/dark/auto controls (drives the settings switcher).
 *
 * 'system' now means «Авто» (UI-v2 S16, ADR-0017): the EVENING palette from 19:00 to 7:00
 * local time — the OS colour scheme deliberately does NOT participate. The provider re-checks
 * on app focus and sleeps exactly until the next 19:00/7:00 boundary. The active override is
 * hydrated from the persisted `profiles` row at launch (ADR-0013, via `initial`); the Settings
 * screen persists changes by calling both `setMode` and `updateProfile`.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { isEveningAt, msUntilThemeBoundary } from '@/lib/auto-theme';

import { darkTheme, lightTheme, type Theme } from './tokens';

/** 'system' is the «Авто» card — kept as the stored value for backward compatibility. */
export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  scheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Evening flag for the «Авто» mode — re-evaluated on focus + exactly at each 19:00/7:00
 *  boundary (ADR-0017: старт/фокус + таймер до ближайшей границы). */
function useEveningClock(): boolean {
  const [evening, setEvening] = useState(() => isEveningAt(Date.now()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer); // an AppState-triggered tick replaces the pending chain (no parallel timers)
      const now = Date.now();
      setEvening(isEveningAt(now));
      // +1s of slack so the wake-up lands ON the far side of the boundary.
      timer = setTimeout(tick, msUntilThemeBoundary(now) + 1000);
    };
    tick();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return evening;
}

export function ThemeProvider({ children, initial = 'system' }: { children: ReactNode; initial?: ThemeMode }) {
  const evening = useEveningClock();
  const [mode, setMode] = useState<ThemeMode>(initial);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: 'light' | 'dark' = mode === 'system' ? (evening ? 'dark' : 'light') : mode;
    return { theme: scheme === 'dark' ? darkTheme : lightTheme, mode, scheme, setMode };
  }, [mode, evening]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

/** Active design tokens (colours, radii, shadows). Stable reference per scheme. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/** Theme-mode controls for the dev toggle / future settings screen. */
export function useThemeMode(): {
  mode: ThemeMode;
  scheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
} {
  const { mode, scheme, setMode } = useThemeContext();
  const cycle = () => {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    setMode(order[(order.indexOf(mode) + 1) % order.length]);
  };
  return { mode, scheme, setMode, cycle };
}

export { catColors, chartColors, darkColors, darkTheme, lightColors, lightTheme } from './tokens';
export type { CatColor, ColorTokens, Theme } from './tokens';
