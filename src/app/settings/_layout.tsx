import { Stack } from 'expo-router';

/** Settings section (home + sub-screens, spec 10 §10.1) — push navigation, headerless. */
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
