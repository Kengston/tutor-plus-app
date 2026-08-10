/**
 * `CreateButton` — кнопка создания с рукописным росчерком перед подписью (слайс #74).
 *
 * Жест «добавить» — одна из трёх зон, где рукописный слой разрешён (§10). Росчерк всегда
 * цвета текста кнопки: он читается как часть надписи, а не как отдельный янтарный значок.
 */
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from '../Text';
import { PlusStroke } from './PlusStroke';

export interface CreateButtonProps {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost';
  /** Кегль росчерка в px. */
  glyphPx?: number;
  style?: ViewStyle;
  /** Смена значения перерисовывает росчерк. */
  drawKey?: string | number;
}

export function CreateButton({
  label,
  onPress,
  tone = 'primary',
  glyphPx = 20,
  style,
  drawKey,
}: CreateButtonProps) {
  const { colors, radius } = useTheme();
  const primary = tone === 'primary';
  const fg = primary ? colors.onTint : colors.heading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        primary ? styles.primary : styles.ghost,
        {
          backgroundColor: primary ? colors.primary : colors.primaryVlight,
          borderRadius: radius.control,
        },
        pressed ? styles.pressed : null,
        style,
      ]}>
      <PlusStroke size="marker" px={glyphPx} color={fg} animated drawKey={drawKey} />
      <Text style={[primary ? styles.primaryLabel : styles.ghostLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  // Высоты канона §7: primary 50, вторичная 44.
  primary: { height: 50, paddingHorizontal: 22 },
  ghost: { height: 44, paddingHorizontal: 16 },
  primaryLabel: { fontSize: 15, fontWeight: '600' },
  ghostLabel: { fontSize: 14.5, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});

export default CreateButton;
