import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function StudentsScreen() {
  const t = useT();
  return (
    <Screen title={t('students.title')}>
      <EmptyState icon="users" text={t('students.empty')} hint={t('common.soon')} />
    </Screen>
  );
}
