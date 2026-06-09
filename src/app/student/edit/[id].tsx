/** Edit Ученик/Клиент — loads the live model, feeds it into the shared form. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStudent, useStudentSubjects } from '@/db/hooks';
import { updateStudent } from '@/db/mutations';
import type { StudentInput } from '@/db/mutations';
import { StudentForm } from '@/features/students/StudentForm';
import { useTheme } from '@/theme';

export default function EditStudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const student = useStudent(id);
  const subjects = useStudentSubjects(id);

  // Single-item hooks return undefined until the row loads — keep the themed
  // shell on screen meanwhile (avoids an unthemed flash before data arrives).
  if (!student) {
    return <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]} />;
  }

  const subjectIds = subjects.map((s) => s.id);

  async function handleSave(input: StudentInput) {
    if (!student) return;
    await updateStudent(student, input);
    router.back();
  }

  return (
    <View style={styles.fill}>
      <StudentForm
        // Remount once the M:N subjects resolve so they seed the chip selection.
        key={`${student.id}:${subjectIds.join(',')}`}
        studentId={student.id}
        initial={{
          name: student.name,
          category: student.category,
          status: student.status,
          format: student.format,
          rate: student.rate,
          schedule: student.schedule,
          phone: student.phone,
          subjectIds,
        }}
        onSave={handleSave}
        onDone={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
