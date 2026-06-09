import { Stack } from 'expo-router';

/** Lesson card + create/edit form routes (push navigation; each screen sets its title). */
export default function LessonLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
