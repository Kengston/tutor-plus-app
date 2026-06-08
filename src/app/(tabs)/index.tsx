import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function TodayScreen() {
  const t = useT();
  return (
    <Screen title={t('today.greeting')}>
      <EmptyState icon="home" text={t('today.empty')} hint={t('common.soon')} />
    </Screen>
  );
}
