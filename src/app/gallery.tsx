/**
 * DEV-ONLY — витрина UI-кита (открывается через DevBar «UI-кит»). НЕ в i18n-скоупе.
 * Реальные продуктовые строки здесь идут через t(), а заголовки секций и демо-данные
 * (имена/предметы/данные графиков/тексты-заглушки) — строительные леса showcase:
 * это НЕ продуктовый UI, поэтому намеренно оставлены литералами и НЕ заведены в strings.ts
 * (ADR-0003 регулирует продуктовые строки). Исключить из i18n-аудита; удалить перед Phase 1.
 */
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { formatRub } from '@/lib/format';
import { chartColors, useTheme } from '@/theme';
import {
  Card,
  CatAvatar,
  Chip,
  CountUp,
  DayLane,
  Donut,
  Dot,
  Fab,
  Icon,
  KpiStat,
  MultiBarChart,
  Ring,
  Segmented,
  Sheet,
  SwipeRow,
} from '@/ui';

/** Phase-0 showcase of the ported UI kit (also a smoke test for the workflow ports). */
export default function Gallery() {
  const { colors } = useTheme();
  const t = useT();
  const [tab, setTab] = useState(t('analytics.overview'));
  const [sheet, setSheet] = useState(false);

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Кольцо · пончик">
          <View style={styles.rowCenter}>
            <Ring progress={0.62} centerTop={<Text style={[styles.big, { color: colors.heading }]}>5/8</Text>} />
            <Donut
              size={132}
              thickness={22}
              segments={[
                { label: 'A', pct: 50, color: chartColors[0] },
                { label: 'B', pct: 30, color: chartColors[1] },
                { label: 'C', pct: 20, color: chartColors[2] },
              ]}
              center={<Text style={[styles.big, { color: colors.heading }]}>100%</Text>}
            />
          </View>
        </Section>

        <Section title="График">
          <MultiBarChart
            data={[
              { label: 'Янв', v: 0.4 },
              { label: 'Фев', v: 0.7 },
              { label: 'Мар', v: 0.55, on: true },
              { label: 'Апр', v: 0.9 },
              { label: 'Май', v: 0.65 },
            ]}
          />
        </Section>

        <Section title="Полоса дня">
          <DayLane
            nowFrac={0.45}
            items={[
              { frac: 0.2, cat: 'terracotta', done: true },
              { frac: 0.5, cat: 'slate' },
              { frac: 0.8, cat: 'sage' },
            ]}
          />
        </Section>

        <Section title="Карточка">
          <Card style={styles.cardPad} leftStrip={colors.terracotta}>
            <View style={styles.cardRow}>
              <CatAvatar initials="АП" cat="terracotta" payTone="debt" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.heading }]}>Анна Петрова</Text>
                <View style={styles.chips}>
                  <Chip tone="primary">Математика</Chip>
                  <Dot tone="red" />
                </View>
              </View>
            </View>
            <View style={styles.kpis}>
              <KpiStat label={t('finance.received')} value={formatRub(12500)} color={colors.paid} />
              <KpiStat label={t('finance.debt')} value={formatRub(3000)} color={colors.danger} />
            </View>
          </Card>
        </Section>

        <Section title="Сегменты">
          <Segmented
            tabs={[t('analytics.overview'), t('analytics.dynamics'), t('analytics.debts')]}
            active={tab}
            onChange={setTab}
          />
        </Section>

        <Section title="Свайп · шит · счётчик">
          <Card>
            <SwipeRow
              rightActions={[{ label: t('common.done'), color: colors.paid, icon: 'check', onPress: () => {} }]}>
              <Pressable onPress={() => setSheet(true)} style={styles.swipeInner}>
                <Text style={{ color: colors.heading, fontWeight: '600' }}>Открыть bottom-sheet</Text>
                <Icon name="chevronRight" size={18} stroke={colors.label3} />
              </Pressable>
            </SwipeRow>
          </Card>
          <Text style={[styles.big, { color: colors.heading, marginTop: 8 }]}>
            <CountUp value={152000} format={formatRub} style={styles.big} />
          </Text>
        </Section>
      </ScrollView>

      <Fab onPress={() => setSheet(true)} bottom={28} />

      {sheet && (
        <Sheet title="Пример шита" onClose={() => setSheet(false)}>
          <Text style={{ color: colors.body, paddingBottom: 20 }}>
            Контент bottom-sheet. Полная анимация и drag-to-dismiss — в порте.
          </Text>
        </Sheet>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 22, paddingBottom: 80 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  big: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cardPad: { padding: 14, gap: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  kpis: { flexDirection: 'row' },
  swipeInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
});
