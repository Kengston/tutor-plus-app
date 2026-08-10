/**
 * Текстовые примитивы кита — единственная точка, где интерфейс получает фирменное
 * начертание Onest (дизайн-система v2 §6, слайс #69).
 *
 * Почему обёртка, а не глобальный дефолт: в RN 0.85 `Text` — обычная функция-компонент
 * (`export default TextImpl`), у неё нет `render` для патча; на вебе базовый класс
 * react-native-web жёстко проставляет системный стек (`font: 14px System`, см.
 * `createReactDOMStyle`), поэтому наследованием через CSS его тоже не перебить, не
 * задев явные `fontFamily`. Обёртка решает обе платформы одинаково и остаётся
 * читаемой: экраны просто импортируют `Text` из `@/ui` вместо `react-native`.
 *
 * Семейство подставляется ПЕРВЫМ элементом массива стилей — значит, любой явный
 * `fontFamily` вниз по цепочке (вордмарк на Manrope, героическая цифра) выигрывает.
 */
import { type ComponentPropsWithRef, type ComponentRef } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextStyle } from 'react-native';

import { onestFor } from '@/theme/fonts';

// `…WithRef`, а не `ComponentProps`: экраны передают ref в поле ввода (шестизначный код
// на «Восстановлении доступа»), и обёртка обязана прокидывать его насквозь.
export type TextProps = ComponentPropsWithRef<typeof RNText>;
export type TextInputProps = ComponentPropsWithRef<typeof RNTextInput>;

/** Инстанс поля ввода — для `useRef` на стороне экранов (тип `TextInput` теперь занят обёрткой). */
export type TextInputHandle = ComponentRef<typeof RNTextInput>;

/** Читаем ТОЛЬКО вес: `flatten` нужен, потому что вес может прийти из любого слоя массива. */
function onestForStyle(style: TextStyle | undefined): string {
  return onestFor(style?.fontWeight);
}

/** `Text` из `react-native` + фирменное семейство под вес стиля. */
export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return <RNText {...rest} style={[{ fontFamily: onestForStyle(flat) }, style]} />;
}

/** То же для полей ввода — введённый текст и плейсхолдер тоже фирменные. */
export function TextInput({ style, ...rest }: TextInputProps) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return <RNTextInput {...rest} style={[{ fontFamily: onestForStyle(flat) }, style]} />;
}

export default Text;
