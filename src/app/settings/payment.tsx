/**
 * «Оплата и валюта» (UI-v2 S15, spec 10 §10.1): the app's currency — Рубль · ₽. Display-only
 * for now (multi-currency arrives with sync, Phase 4); the row exists so the section matches
 * the spec structure and the value is honest.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useBack } from '@/lib/nav';
import { useTheme } from '@/theme';
import { Card, Icon } from '@/ui';

export default function PaymentSettingsScreen() {
  const goBack = useBack();
  const t = useT();
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('set.payment')} onBack={() => goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <Icon name="ruble" size={19} sw={1.7} stroke={colors.stoneInactive} />
            <Text style={[styles.rowLabel, { color: colors.heading }]}>{t('set.currency')}</Text>
            <Text style={[styles.rowValue, { color: colors.heading }]}>{t('set.currencyRub')}</Text>
          </View>
        </Card>
        <Text style={[styles.hint, { color: colors.muted }]}>{t('set.currencyHint')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Compact stack header — mirrors settings/index.tsx. */
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={title}>
        <Icon name="back" size={20} stroke={colors.heading} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.heading }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 10 },

  card: { paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13, fontWeight: '500', paddingHorizontal: 2, lineHeight: 18 },

  pressed: { opacity: 0.85 },
});
