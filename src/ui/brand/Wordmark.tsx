/**
 * `Wordmark` — логотип-текст: живое слово «Tutor» в Manrope display + тот же SVG-плюс
 * (слайс #74 спеки #68).
 *
 * НИКОГДА не картинкой: вордмарк должен масштабироваться, наследовать цвет темы и
 * доезжать до скринридера как текст. Слово — единственное место в продукте, где
 * латиница набирается display-начертанием (дизайн-система v2 §6).
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { displayFor } from '@/theme/fonts';

import { Text } from '../Text';
import { MICRO_THRESHOLD_PX } from './glyph';
import { PlusStroke } from './PlusStroke';

/** Слово знака — латиница, вне i18n: имя бренда не переводится и не переключается модом. */
const BRAND_WORD = 'Tutor';

export interface WordmarkProps {
  /** Кегль слова в px; размеры плюса и трекинг считаются от него. */
  px?: number;
  color?: string;
  plusColor?: string;
  animated?: boolean;
  drawKey?: string | number;
}

export function Wordmark({ px = 30, color, plusColor, animated = false, drawKey }: WordmarkProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.word,
          {
            fontFamily: displayFor('800'),
            fontSize: px,
            lineHeight: px * 1.1,
            // −0.02em канона в единицах RN — доля от кегля, а не фиксированные px.
            letterSpacing: -0.02 * px,
            color: color ?? colors.heading,
          },
        ]}>
        {BRAND_WORD}
      </Text>
      <View style={{ marginLeft: px * 0.06 }}>
        <PlusStroke
          // Мелкий вордмарк берёт «маркер»: перо на малом кегле теряет нажим.
          size={px < MICRO_THRESHOLD_PX + 6 ? 'marker' : 'pen'}
          px={px * 0.78}
          color={plusColor ?? colors.brandPlusInk}
          animated={animated}
          drawKey={drawKey}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { fontWeight: '800' },
});

export default Wordmark;
