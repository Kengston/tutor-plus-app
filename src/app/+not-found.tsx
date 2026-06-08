import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export default function NotFound() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Не найдено' }} />
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.heading }]}>Страница не найдена</Text>
        <Link href="/" style={[styles.link, { color: colors.primary }]}>
          На главную
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
