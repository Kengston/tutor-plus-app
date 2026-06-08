import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type ChipTone = 'neutral' | 'primary' | 'danger' | 'warning' | 'paid';

export interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
}

export function Chip({ children, tone = 'neutral' }: ChipProps) {
  const { colors } = useTheme();
  const tones: Record<ChipTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.stoneLight, fg: colors.stone700 },
    primary: { bg: colors.accentSoft, fg: colors.heading },
    danger: { bg: colors.dangerLight, fg: colors.danger },
    warning: { bg: colors.warningLight, fg: colors.warning },
    paid: { bg: colors.accentSoft, fg: colors.heading },
  };
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  label: { fontSize: 12.5, fontWeight: '600', lineHeight: 15 },
});

export default Chip;
