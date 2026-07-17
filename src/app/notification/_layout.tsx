import { Stack } from 'expo-router';

/** Notification sub-route (the detail screen) — push navigation, headerless (custom Header). */
export default function NotificationLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
