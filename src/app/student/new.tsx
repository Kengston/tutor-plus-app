/** New Ученик/Клиент — thin route wrapper around the shared StudentForm. */

import { createStudent } from '@/db/mutations';
import type { StudentInput } from '@/db/mutations';
import { StudentForm } from '@/features/students/StudentForm';
import { useBack } from '@/lib/nav';

export default function NewStudentScreen() {
  const goBack = useBack();

  async function handleSave(input: StudentInput) {
    await createStudent(input);
    goBack();
  }

  return <StudentForm onSave={handleSave} onDone={() => goBack()} />;
}
