import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import type { Activity, ClientType } from '@/i18n';
import type { ThemeMode } from '@/theme';

/**
 * Single-row practitioner profile + prefs (ADR-0013). Hydrates `ThemeProvider` /
 * `DualModeProvider` (closes the Phase-0 in-memory TODO) and houses reminder settings.
 * Field names match the `ProfileData` read-shape (domain/types) so a model instance
 * structurally satisfies it. Becomes a real synced row in Phase 4 (ADR-0002).
 */
export class ProfileModel extends Model {
  static table = 'profiles';

  @text('name') name!: string;
  @field('activity') activity!: Activity;
  /** Dual-mode lexicon axis (ADR-0006). */
  @field('client_type') clientType!: ClientType;
  @text('tz') tz!: string;
  @field('theme') theme!: ThemeMode;
  /** Reminder lead-time in minutes: 10 | 20 | 60 | 1440. */
  @field('reminder_lead_min') reminderLeadMin!: number;
  @field('notif_lessons') notifLessons!: boolean;
  @field('notif_payment') notifPayment!: boolean;
  @field('notif_schedule') notifSchedule!: boolean;
  @field('notif_summary') notifSummary!: boolean;
  /** OS notification permission granted (Web Notifications on web; expo-notifications on native). */
  @field('push_granted') pushGranted!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
