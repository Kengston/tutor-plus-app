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
  /** v8 master switch + debts split (spec 09 §9.3) — NULLABLE: null (migrated rows) reads as TRUE. */
  @field('notif_enabled') notifEnabled!: boolean | null;
  @field('notif_debts') notifDebts!: boolean | null;
  /** v9 (spec 10 §10.2): contact + working days (CSV of getDay indices; null reads as Пн–Пт). */
  @field('phone') phone!: string | null;
  @field('work_days') workDays!: string | null;
  /** v10 (spec 10 §10.1): visible OPTIONAL Today blocks (CSV; null = all visible). */
  @field('home_blocks') homeBlocks!: string | null;
  /** v11 (spec 03 §3.4): registration-wizard defaults for a new lesson (null → legacy). */
  @field('default_rate') defaultRate!: number | null;
  @field('default_duration') defaultDuration!: number | null;
  @field('default_format') defaultFormat!: string | null;
  /** OS notification permission granted (Web Notifications on web; expo-notifications on native). */
  @field('push_granted') pushGranted!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
