import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * SSR-safe color scheme for web: returns 'light' during the server render and the first client
 * paint (so hydration matches), then the real device scheme. Uses `useSyncExternalStore` (with a
 * server snapshot) instead of a mount-effect hydration flag, so there is no setState-in-effect
 * (react-hooks/set-state-in-effect). `useRNColorScheme()` drives the re-render on scheme change;
 * `getSnapshot` then returns the updated value.
 */
const noopSubscribe = () => () => {};

export function useColorScheme(): 'light' | 'dark' {
  const scheme = useRNColorScheme();
  return useSyncExternalStore(
    noopSubscribe,
    () => (scheme === 'dark' ? 'dark' : 'light'),
    () => 'light',
  );
}
