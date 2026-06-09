import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { useT } from '@/i18n';

export default function NotFound() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.heading }]}>{t('notFound.message')}</Text>
        <Link
          href="/"
          style={[styles.link, { color: colors.primary }]}
          accessibilityRole="link"
          accessibilityLabel={t('notFound.action')}
        >
          {t('notFound.action')}
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '600' },
  link: { fontSize: 15, fontWeight: '600', marginTop: 12 },
});
