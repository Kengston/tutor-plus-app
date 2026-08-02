/**
 * Navigation helpers.
 *
 * `useBack` exists because every pushed screen is reachable by URL on web: a deep link, a
 * reload (F5) or a shared `/lesson/:id` starts the stack AT that screen, so `router.back()`
 * has nothing to pop — react-navigation answers «The action 'GO_BACK' was not handled» and
 * the user is stuck on a screen whose back button does nothing (TP-FIX-0719, пп. 5/6).
 * Falling back to the app root keeps «назад» meaningful in that case; when the screen was
 * pushed normally, this is plain `router.back()`.
 */
import { router, useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useBack(): () => void {
  const r = useRouter();
  return useCallback(() => {
    if (r.canGoBack()) r.back();
    else r.replace('/');
  }, [r]);
}

/** Imperative twin, for the screens that navigate through the `router` singleton. */
export function backOrHome(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
