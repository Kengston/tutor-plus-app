/**
 * `AppPlate` — плитка приложения: чернильная подложка, ivory T, янтарный плюс (слайс #74).
 *
 * По канону айдентики плитки НЕТ на экранах входа и регистрации — она живёт в переходной
 * заставке и в сайдбаре веб-версии (дизайн-система v2 §10, PROJECT_STATE §5).
 */
import { StyleSheet, View } from 'react-native';

import { brandPlate, useTheme } from '@/theme';

import { TSymbol } from './TMark';

export interface AppPlateProps {
  px?: number;
  radius?: number;
  plusColor?: string;
  animated?: boolean;
  drawKey?: string | number;
}

export function AppPlate({ px = 72, radius, plusColor, animated = false, drawKey }: AppPlateProps) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.plate,
        // Подложка знака заморожена в обеих темах — это иконка, а не элемент интерфейса.
        { width: px, height: px, borderRadius: radius ?? px * 0.27, backgroundColor: brandPlate.bg },
      ]}>
      <TSymbol
        px={px * 0.62}
        colorT={brandPlate.mark[scheme]}
        colorPlus={plusColor ?? colors.accent}
        animated={animated}
        drawKey={drawKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { alignItems: 'center', justifyContent: 'center' },
});

export default AppPlate;
