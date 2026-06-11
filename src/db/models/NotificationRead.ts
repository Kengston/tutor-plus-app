import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

/**
 * Read-state of one DERIVED notification item (ADR-0013). The feed is a view-model
 * (`domain/notifications`), never a stored `notifications` table — this is the ONLY
 * persistence it needs: `unread = item.id ∉ notification_reads`. `itemId` is the stable
 * synthetic id (`reminder:<lessonId>`, `payment:<txnId>`, …).
 */
export class NotificationReadModel extends Model {
  static table = 'notification_reads';

  @field('item_id') itemId!: string;
  @field('read_at') readAt!: number;
}
