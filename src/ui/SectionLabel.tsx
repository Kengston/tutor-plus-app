import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export interface SectionLabelProps {
  children: ReactNode;
  right?: ReactNode;
}

export function SectionLabel({ children, right }: SectionLabelProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.heading }]}>{children}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '500', letterSpacing: -0.1 },
});

export default SectionLabel;
