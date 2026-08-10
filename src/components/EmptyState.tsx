/**
 * Пустое состояние по канону (слайс #78 спеки #68): рукописная «пометка на полях» +
 * одна строка сути + одна строка действия (дизайн-система v2 §8).
 *
 * Стоковых иконок здесь больше нет: иллюстративный слой пустых экранов — одна из трёх зон,
 * где канон разрешает рукописное (§10). Раньше на этом месте стояла серая контурная иконка
 * кита — она читалась как «функция отключена», а не как «здесь пока пусто».
 *
 * Действие не опционально по духу канона — пустой экран без выхода это тупик, — но в типах
 * оно необязательно: часть поверхностей это «объект не найден», где осмысленный выход даёт
 * сам вызывающий экран (кнопка «назад» в его шапке).
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { CreateButton, MarginMark, Text, type MarginMarkKind } from '@/ui';

export interface EmptyStateProps {
  /** Вид пометки. По умолчанию — двойной плюс: «здесь пока ничего, добавьте». */
  mark?: MarginMarkKind;
  text: string;
  hint?: string;
  /** Подпись кнопки действия. Без `onAction` кнопка не рисуется. */
  action?: string;
  onAction?: () => void;
  /**
   * `create` — действие СОЗДАЁТ сущность, и кнопка получает рукописный росчерк.
   * `plain` — всё остальное (сбросить фильтр, открыть настройки): росчерк там был бы
   * враньём, плюс означает «добавить», а дозировка рукописного слоя ограничена тремя
   * зонами (дизайн-система v2 §10).
   */
  actionKind?: 'create' | 'plain';
  /** Число в кружке для пометки `circle_date`. */
  date?: number | string;
}

export function EmptyState({
  mark = 'plus_double',
  text,
  hint,
  action,
  onAction,
  actionKind = 'create',
  date,
}: EmptyStateProps) {
  const { colors, radius } = useTheme();
  const hasAction = Boolean(action && onAction);

  return (
    <View style={styles.wrap}>
      <MarginMark kind={mark} px={72} date={date} />
      <Text style={[styles.text, { color: colors.heading }]}>{text}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
      {hasAction && actionKind === 'create' ? (
        <CreateButton label={action!} onPress={onAction!} style={styles.action} />
      ) : null}
      {hasAction && actionKind === 'plain' ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.plainBtn,
            styles.action,
            { backgroundColor: colors.primaryVlight, borderRadius: radius.control },
            pressed ? styles.pressed : null,
          ]}>
          <Text style={[styles.plainLabel, { color: colors.heading }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  text: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 18 },
  hint: { fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 6, maxWidth: 260 },
  action: { marginTop: 18 },
  plainBtn: { height: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  plainLabel: { fontSize: 14.5, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});
