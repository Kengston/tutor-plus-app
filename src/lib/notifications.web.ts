/**
 * Web scheduler (ADR-0013). Permission via the Web Notifications API; OS-level SCHEDULING is
 * not available to us on web → `sync` is a no-op (the in-app feed is the web surface). Real
 * local scheduling lands on native (`notifications.ts`, expo-notifications), verified under OQ-F.
 * Metro resolves THIS file on web (`.web.ts`) and `notifications.ts` on native.
 */
import type { LocalReminder, NotificationScheduler } from './notification-scheduler';

const supported = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

export const scheduler: NotificationScheduler = {
  async getPermission() {
    return supported() ? Notification.permission === 'granted' : false;
  },
  async requestPermission() {
    if (!supported()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      return (await Notification.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  },
  async sync(_reminders: readonly LocalReminder[]) {
    // no-op on web — OS-level scheduling is native-only (ADR-0013).
  },
};
