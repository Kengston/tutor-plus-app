import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export interface KpiStatProps {
  label: string;
  value: string | number;
  color?: string;
}

export function KpiStat({ label, value, color }: KpiStatProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.tile}>
      <Text style={[styles.value, { color: color ?? colors.heading }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  value: { fontSize: 19, fontWeight: '600', fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, marginTop: 3 },
});

export default KpiStat;
