/**
 * Native scheduler (ADR-0013) — local OS notifications via expo-notifications. WRITTEN but NOT
 * verified on the web track (needs a dev build, OQ-F) — same posture as the native SQLite
 * adapter (`db/index.ts`). Metro resolves `notifications.web.ts` on web, so this file (and its
 * expo-notifications import) never bundles there; tsc still typechecks it.
 */
import * as Notifications from 'expo-notifications';

import type { LocalReminder, NotificationScheduler } from './notification-scheduler';

export const scheduler: NotificationScheduler = {
  async getPermission() {
    const { granted } = await Notifications.getPermissionsAsync();
    return granted;
  },
  async requestPermission() {
    const { granted } = await Notifications.requestPermissionsAsync();
    return granted;
  },
  async sync(reminders: readonly LocalReminder[]) {
    // Rolling-window (iOS 64 pending cap): replace the whole pending set, then schedule
    // the planned nearest-N. Idempotent — safe to call on every lessons/prefs change.
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of reminders) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt },
      });
    }
  },
};
