import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function AnalyticsScreen() {
  const t = useT();
  return (
    <Screen title={t('analytics.title')}>
      <EmptyState icon="chart" text={t('analytics.empty')} hint={t('common.soon')} />
    </Screen>
  );
}
