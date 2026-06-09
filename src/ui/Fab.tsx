import { Pressable, StyleSheet } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';

import { Icon } from './Icon';

export interface FabProps {
  onPress: () => void;
  bottom?: number;
}

export function Fab({ onPress, bottom = 24 }: FabProps) {
  const { colors, shadow } = useTheme();
  const t = useT();
  return (
    <Pressable
      accessibilityLabel={t('common.add')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { bottom, backgroundColor: colors.primary, boxShadow: shadow.fab },
        pressed ? styles.pressed : null,
      ]}>
      <Icon name="plus" size={26} sw={2} stroke={colors.onTint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});

export default Fab;
