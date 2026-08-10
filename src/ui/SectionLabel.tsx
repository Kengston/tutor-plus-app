import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';

export interface SectionLabelProps {
  children: ReactNode;
  right?: ReactNode;
  /**
   * Янтарная акцентная черта слева — ВКЛЮЧЕНА ПО УМОЛЧАНИЮ во всех разделах
   * (дизайн-система v2 §8 и §15, слайс #72). Отключать точечно — там, где лейбл сам
   * играет роль группировки списка: у групп-лейблов черты нет.
   */
  accent?: boolean;
}

export function SectionLabel({ children, right, accent = true }: SectionLabelProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        {accent ? <View style={[styles.bar, { backgroundColor: colors.accent }]} /> : null}
        <Text style={[styles.label, { color: colors.heading }]}>{children}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  // gap 7 и сдвиг черты на 1px вниз — из эталона кита: черта садится по оптической
  // середине строки, а не по её baseline-боксу.
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  bar: { width: 2, height: 12, borderRadius: 2, opacity: 0.85, transform: [{ translateY: 1 }] },
  label: { fontSize: 14, fontWeight: '500', letterSpacing: -0.1 },
});

export default SectionLabel;
