import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function FinanceScreen() {
  const t = useT();
  return (
    <Screen title={t('finance.title')}>
      <EmptyState icon="wallet" text={t('finance.empty')} hint={t('common.soon')} />
    </Screen>
  );
}
