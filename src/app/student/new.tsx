/** New Ученик/Клиент — thin route wrapper around the shared StudentForm. */
import { useRouter } from 'expo-router';

import { createStudent } from '@/db/mutations';
import type { StudentInput } from '@/db/mutations';
import { StudentForm } from '@/features/students/StudentForm';

export default function NewStudentScreen() {
  const router = useRouter();

  async function handleSave(input: StudentInput) {
    await createStudent(input);
    router.back();
  }

  return <StudentForm onSave={handleSave} onDone={() => router.back()} />;
}
