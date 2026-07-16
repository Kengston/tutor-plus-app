import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

import type { ExpectationStatus } from '@/domain/types';

/**
 * Ожидание — money promised WITHOUT a lesson (ADR-0015): participant + amount + due date,
 * `status` open/closed. A plain CRUD entity OUTSIDE the append-only ledger (NOT a transaction):
 * never counted in received/debt. Unlike `TransactionModel`, `status` IS mutable — settling
 * flips it to `closed` (see `db/mutations.settleExpectationPaid`).
 */
export class ExpectationModel extends Model {
  static table = 'expectations';

  @field('student_id') studentId!: string;
  @field('amount') amount!: number;
  @field('due_at') dueAt!: number;
  @field('comment') comment!: string | null;
  @field('status') status!: ExpectationStatus;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
