/**
 * `EmptyMark` — заготовка пустого состояния по канону (слайс #74, применяется в #78).
 *
 * Форма канона (§8): одна пометка на полях + ОДНА строка сути + ОДНА строка действия.
 * Стоковых картинок нет; текста больше двух строк — тоже.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from '../Text';
import { CreateButton } from './CreateButton';
import { MarginMark, type MarginMarkKind } from './MarginMark';

export interface EmptyMarkProps {
  mark?: MarginMarkKind;
  /** Строка сути — что здесь пусто. */
  title: string;
  /** Необязательная поясняющая строка. */
  hint?: string;
  /** Подпись действия. Без неё пустое состояние остаётся без выхода — так не делаем. */
  action?: string;
  onAction?: () => void;
  /** Число в кружке для пометки `circle_date`. */
  date?: number | string;
  markColor?: string;
  style?: ViewStyle;
}

export function EmptyMark({
  mark = 'plus_pen',
  title,
  hint,
  action,
  onAction,
  date,
  markColor,
  style,
}: EmptyMarkProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <MarginMark kind={mark} px={72} date={date} color={markColor} />
      <Text style={[styles.title, { color: colors.heading }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
      {action && onAction ? (
        <CreateButton label={action} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  title: { fontSize: 16, fontWeight: '600', marginTop: 18, textAlign: 'center' },
  hint: { fontSize: 13.5, marginTop: 6, lineHeight: 19, maxWidth: 260, textAlign: 'center' },
  action: { marginTop: 18 },
});

export default EmptyMark;
