import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';

export interface FabProps {
  onPress: () => void;
  bottom?: number;
}

export function Fab({ onPress, bottom = 104 }: FabProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel="Добавить"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { bottom, backgroundColor: colors.primary, boxShadow: '0px 10px 24px -6px rgba(0,0,0,0.35)' },
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
