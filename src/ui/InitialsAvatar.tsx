import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export interface InitialsAvatarProps {
  initials: string;
  size?: number;
  onPress?: () => void;
}

export function InitialsAvatar({ initials, size = 36, onPress }: InitialsAvatarProps) {
  const { colors } = useTheme();
  const inner = (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryLight },
      ]}>
      <Text style={{ color: colors.primaryDeep, fontSize: size * 0.38, fontWeight: '500' }}>{initials}</Text>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityLabel="Профиль" onPress={onPress}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});

export default InitialsAvatar;
