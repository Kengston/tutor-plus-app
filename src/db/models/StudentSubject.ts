import { associations, Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

/** M:N join between students and subjects/directions. */
export class StudentSubjectModel extends Model {
  static table = 'student_subjects';
  static associations = associations(
    ['students', { type: 'belongs_to', key: 'student_id' }],
    ['subjects', { type: 'belongs_to', key: 'subject_id' }],
  );

  @field('student_id') studentId!: string;
  @field('subject_id') subjectId!: string;
}
