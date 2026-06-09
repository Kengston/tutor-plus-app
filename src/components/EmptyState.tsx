import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, type IconName } from '@/ui';

export interface EmptyStateProps {
  icon?: IconName;
  text: string;
  hint?: string;
}

export function EmptyState({ icon = 'sparkle', text, hint }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Icon name={icon} size={44} sw={1.4} stroke={colors.label3} />
      <Text style={[styles.text, { color: colors.muted }]}>{text}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 72, gap: 12 },
  text: { fontSize: 15.5, fontWeight: '500', textAlign: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
});
