import { associations, Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

import type { Duration, LessonFormat } from '@/domain/types';

/**
 * Слот расписания — a recurring series in a student's weekly schedule (ADR-0016).
 * Lessons are MATERIALIZED from active slots into a rolling window (`domain/schedule-slots`).
 * `weekday`/`time_min` are local wall-clock; the rest default from the student, overridable.
 */
export class ScheduleSlotModel extends Model {
  static table = 'schedule_slots';
  static associations = associations(
    ['students', { type: 'belongs_to', key: 'student_id' }],
    ['subjects', { type: 'belongs_to', key: 'subject_id' }],
  );

  @field('student_id') studentId!: string;
  @field('weekday') weekday!: number; // 0=Sun … 6=Sat
  @field('time_min') timeMin!: number; // minutes from local midnight
  @field('duration_min') durationMin!: Duration;
  @field('format') format!: LessonFormat;
  @field('price') price!: number;
  @field('subject_id') subjectId!: string | null;
  @field('active_from') activeFrom!: number;
  @field('active_to') activeTo!: number | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
