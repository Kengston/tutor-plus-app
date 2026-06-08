import { StyleSheet, Text, View } from 'react-native';

import { catColors, useTheme, type CatColor } from '@/theme';

export type PayTone = 'paid' | 'debt' | 'pending';

export interface CatAvatarProps {
  initials: string;
  cat: CatColor;
  size?: number;
  /** Optional payment-status badge in the corner. */
  payTone?: PayTone;
}

export function CatAvatar({ initials, cat, size = 40, payTone }: CatAvatarProps) {
  const { colors } = useTheme();
  const c = catColors[cat] ?? catColors.slate;
  const payColor =
    payTone === 'paid' ? colors.paid : payTone === 'debt' ? colors.danger : payTone === 'pending' ? colors.warning : null;
  const badge = Math.max(size * 0.3, 11);
  return (
    <View>
      <View
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg },
        ]}>
        <Text style={{ color: c.text, fontSize: size * 0.36, fontWeight: '600' }}>{initials}</Text>
      </View>
      {payColor && (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            backgroundColor: payColor,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});

export default CatAvatar;
