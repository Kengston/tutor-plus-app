import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

/** A free-form note on a student's profile (spec 06 §6.3) — text + when it was added. */
export class StudentNoteModel extends Model {
  static table = 'student_notes';

  @field('student_id') studentId!: string;
  @text('text') text!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
