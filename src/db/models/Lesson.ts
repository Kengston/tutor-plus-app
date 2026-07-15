import { associations, Model, Query } from '@nozbe/watermelondb';
import { children, date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import type { Duration, LessonFormat, LifecycleStatus } from '@/domain/types';

import type { TransactionModel } from './Transaction';

/**
 * Занятие/Встреща — a scheduled event. `lifecycle_status` is a SEPARATE axis from
 * payment (R8); `payStatus` is NOT stored — derive from linked transactions (ADR-0008).
 * `starts_at` is UTC-instant ms (ADR-0005).
 */
export class LessonModel extends Model {
  static table = 'lessons';
  static associations = associations(
    ['students', { type: 'belongs_to', key: 'student_id' }],
    ['subjects', { type: 'belongs_to', key: 'subject_id' }],
    ['transactions', { type: 'has_many', foreignKey: 'lesson_id' }],
  );

  @field('student_id') studentId!: string;
  @field('subject_id') subjectId!: string | null;
  @text('topic') topic!: string;
  @field('starts_at') startsAt!: number;
  @field('duration_min') durationMin!: Duration;
  @field('format') format!: LessonFormat;
  @field('price') price!: number;
  /** Meeting URL (delta v2.1 §3.1) — see domain/lesson-link for visibility rules. */
  @field('link') link!: string | null;
  /** Series link (ADR-0016): the slot this lesson was materialized from (null = standalone). */
  @field('slot_id') slotId!: string | null;
  /** Local-midnight ms of the intended occurrence — the (slot_id, slot_date) idempotency key. */
  @field('slot_date') slotDate!: number | null;
  /** Set when a materialized lesson is manually edited — the generator won't touch it. */
  @field('modified') modified!: boolean;
  @field('lifecycle_status') lifecycleStatus!: LifecycleStatus;
  @field('cancel_reason') cancelReason!: string | null;
  @field('comment') comment!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('transactions') transactions!: Query<TransactionModel>;
}
