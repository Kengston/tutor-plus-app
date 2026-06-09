import { Stack } from 'expo-router';

/** Student card + form routes (push navigation; each screen sets its own title). */
export default function StudentLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
