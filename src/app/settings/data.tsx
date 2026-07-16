/**
 * «Данные и поддержка» (UI-v2 S15, spec 10 §10.1) — the four rows: «Экспорт» (jumps to the
 * Analytics report sheet — the CSV lives there), «Резервная копия» (with its date — honest
 * stub until sync, Phase 4), «Помощь», «Документы». Backend-dependent rows carry «Скоро».
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT, type StringKey } from '@/i18n';
import { nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { Card, Chip, Icon } from '@/ui';

export default function DataSupportScreen() {
  const router = useRouter();
  const t = useT();
  const { colors } = useTheme();

  // «Резервная копия» date — the local DB is the live copy, so «today» is honest (LokiJS/
  // IndexedDB persists continuously); a real backup timestamp arrives with sync (Phase 4).
  const d = new Date(nowMs());
  const backupDate = `${d.getDate()} ${t(`monthGen.${d.getMonth()}` as StringKey)}`;

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('set.dataSupport')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          {/* Экспорт — the report/CSV flow lives on the Analytics screen (share icon). */}
          <Pressable
            onPress={() => router.push('/analytics')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Icon name="download" size={19} sw={1.7} stroke={colors.stoneInactive} />
            <Text style={[styles.rowLabel, { color: colors.heading }]}>{t('set.export')}</Text>
            <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
          </Pressable>

          <Hairline />

          {/* Резервная копия — с датой (spec §10.1). */}
          <View style={styles.row}>
            <Icon name="refresh" size={19} sw={1.7} stroke={colors.stoneInactive} />
            <Text style={[styles.rowLabel, { color: colors.heading }]}>{t('settings.backup')}</Text>
            <Text style={[styles.rowValue, { color: colors.muted }]}>{backupDate}</Text>
          </View>

          <Hairline />

          <View style={[styles.row, styles.deferred]}>
            <Icon name="info" size={19} sw={1.7} stroke={colors.stoneInactive} />
            <Text style={[styles.rowLabel, { color: colors.heading }]}>{t('set.help')}</Text>
            <Chip tone="neutral">{t('settings.soon')}</Chip>
          </View>

          <Hairline />

          <View style={[styles.row, styles.deferred]}>
            <Icon name="link" size={19} sw={1.7} stroke={colors.stoneInactive} />
            <Text style={[styles.rowLabel, { color: colors.heading }]}>{t('set.documents')}</Text>
            <Chip tone="neutral">{t('settings.soon')}</Chip>
          </View>
        </Card>
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

function Hairline() {
  const { colors } = useTheme();
  return <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />;
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
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },

  card: { paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 14, fontWeight: '500' },
  deferred: { opacity: 0.7 },
  hairline: { height: StyleSheet.hairlineWidth },

  pressed: { opacity: 0.85 },
});
