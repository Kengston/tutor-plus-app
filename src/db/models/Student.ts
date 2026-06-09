import { associations, Model, Query } from '@nozbe/watermelondb';
import { children, date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import type { LessonFormat, StudentStatus } from '@/domain/types';
import type { CatColor } from '@/theme';

import type { LessonModel } from './Lesson';
import type { StudentSubjectModel } from './StudentSubject';
import type { TransactionModel } from './Transaction';

/** Ученик/Клиент — central entity. `debt` is NOT stored; derive via aggregates (ADR-0008). */
export class StudentModel extends Model {
  static table = 'students';
  static associations = associations(
    ['lessons', { type: 'has_many', foreignKey: 'student_id' }],
    ['transactions', { type: 'has_many', foreignKey: 'student_id' }],
    ['student_subjects', { type: 'has_many', foreignKey: 'student_id' }],
  );

  @text('name') name!: string;
  @text('initials') initials!: string;
  @field('category') category!: CatColor;
  @field('status') status!: StudentStatus;
  @field('format') format!: LessonFormat;
  @field('rate') rate!: number;
  @text('schedule') schedule!: string;
  @text('phone') phone!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('lessons') lessons!: Query<LessonModel>;
  @children('transactions') transactions!: Query<TransactionModel>;
  @children('student_subjects') studentSubjects!: Query<StudentSubjectModel>;
}
