import { View } from 'react-native';

import { useTheme } from '@/theme';

export type DotTone = 'green' | 'red' | 'amber' | 'stone';

export interface DotProps {
  tone?: DotTone;
  size?: number;
}

export function Dot({ tone = 'green', size = 9 }: DotProps) {
  const { colors } = useTheme();
  const map: Record<DotTone, string> = {
    green: colors.paid,
    red: colors.danger,
    amber: colors.warning,
    stone: colors.stoneInactive,
  };
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: map[tone] }} />;
}

export default Dot;
