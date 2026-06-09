/**
 * Silence react-native-web 0.21's OWN internal `pointerEvents`-prop deprecation.
 *
 * RNW deprecated the `pointerEvents` PROP in favour of `style.pointerEvents`, but its
 * own components still pass the prop internally — `Pressable` (dist/exports/Pressable),
 * `AppContainer`, `Touchable`, `Modal` — so the warning fires from INSIDE the library on
 * essentially every Pressable, not from app code (our kit was migrated to
 * `style.pointerEvents`). It is dev-only (RN strips warnings from production builds) and
 * is an upstream bug to be fixed in a future RNW release. We filter just this one message
 * so the dev console stays clean. Imported first in app/_layout.tsx, before any render.
 */
if (__DEV__) {
  const original = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('props.pointerEvents is deprecated')) {
      return;
    }
    original(...(args as []));
  };
}
