import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface CardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Coloured left accent strip (e.g. a student's category colour). */
  leftStrip?: string;
}

export function Card({ children, style, onPress, leftStrip }: CardProps) {
  const { colors, radius, shadow } = useTheme();
  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderColor: colors.hairline,
          boxShadow: shadow.card,
        },
        leftStrip ? { borderLeftWidth: 3, borderLeftColor: leftStrip } : null,
        style,
      ]}>
      {children}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
});

export default Card;
