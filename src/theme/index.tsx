/**
 * Theme runtime — provider + hooks.
 *
 * `useTheme()`     → active design tokens (stable reference per scheme).
 * `useThemeMode()` → light/dark/system controls (drives the dev toggle).
 *
 * Light/dark follows the OS by default ('system'); an explicit override is
 * kept in memory for Phase 0 (persistence lands with the settings screen).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { darkTheme, lightTheme, type Theme } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  scheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: 'light' | 'dark' =
      mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
    return { theme: scheme === 'dark' ? darkTheme : lightTheme, mode, scheme, setMode };
  }, [mode, system]);

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

export { catColors, chartColors, darkTheme, lightTheme } from './tokens';
export type { CatColor, ColorTokens, Theme } from './tokens';
