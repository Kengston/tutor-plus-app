import { associations, Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

import type { PayMethod, TxnType } from '@/domain/types';

/**
 * Операция — APPEND-ONLY financial record (ADR-0002): once written, amount/type are
 * never edited in place; corrections/cancellations are NEW compensating rows. Belongs
 * to a Student; `lesson_id` link is optional (prepayment/packages/general debt, ADR-0008).
 * Hence: no update writers here.
 */
export class TransactionModel extends Model {
  static table = 'transactions';
  static associations = associations(
    ['students', { type: 'belongs_to', key: 'student_id' }],
    ['lessons', { type: 'belongs_to', key: 'lesson_id' }],
    ['subjects', { type: 'belongs_to', key: 'subject_id' }],
  );

  @field('student_id') studentId!: string;
  @field('lesson_id') lessonId!: string | null;
  @field('amount') amount!: number;
  @field('type') type!: TxnType;
  @field('method') method!: PayMethod | null;
  @field('subject_id') subjectId!: string | null;
  @field('occurred_at') occurredAt!: number;
  @field('comment') comment!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
