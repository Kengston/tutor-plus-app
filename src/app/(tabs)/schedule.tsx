import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function ScheduleScreen() {
  const t = useT();
  return (
    <Screen title={t('schedule.title')}>
      <EmptyState icon="calendar" text={t('schedule.empty')} hint={t('common.soon')} />
    </Screen>
  );
}
