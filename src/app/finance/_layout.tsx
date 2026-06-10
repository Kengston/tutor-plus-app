import { Stack } from 'expo-router';

/** Finance sub-routes (operation detail + new operation) — push navigation, each sets its title. */
export default function FinanceLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
