import { associations, Model, Query } from '@nozbe/watermelondb';
import { children, date, readonly, text } from '@nozbe/watermelondb/decorators';

import type { LessonModel } from './Lesson';
import type { StudentSubjectModel } from './StudentSubject';

/** Предмет/Направление — neutral name; lexicon applied at display (ADR-0006). */
export class SubjectModel extends Model {
  static table = 'subjects';
  static associations = associations(
    ['lessons', { type: 'has_many', foreignKey: 'subject_id' }],
    ['student_subjects', { type: 'has_many', foreignKey: 'subject_id' }],
  );

  @text('name') name!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('lessons') lessons!: Query<LessonModel>;
  @children('student_subjects') studentSubjects!: Query<StudentSubjectModel>;
}
