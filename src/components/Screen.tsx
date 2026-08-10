import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initialFabScrollState, nextFabScrollState } from '@/lib/fab-scroll';
import { useTheme } from '@/theme';
import { FabVisibilityProvider } from '@/ui';

import { AppHeader } from './AppHeader';
import { DevBar } from './DevBar';

export interface ScreenProps {
  title: string;
  /** Optional line under the title — the Today screen's date («вторник, 26 мая»). */
  subtitle?: string;
  /** Section-specific header icon actions (search/filter/sort/export — UI-v2 S18). */
  actions?: ReactNode;
  /** Show the notifications bell in the header — the «Сегодня» screen only (spec 04). */
  bell?: boolean;
  children?: ReactNode;
  scroll?: boolean;
  /** Pinned overlay over the body (e.g. a <Fab/>) — sits in the FULL-HEIGHT safe area,
   *  not the scroll content, so it stays anchored above the tab bar regardless of scroll. */
  floatingAction?: ReactNode;
}

/** Themed tab-screen shell: safe-area + real AppHeader (contextual actions + avatar) + body +
 *  optional pinned FAB. The Phase-0 DevBar is kept under `__DEV__` only (ADR-0013). */
export function Screen({ title, subtitle, actions, bell, children, scroll = true, floatingAction }: ScreenProps) {
  const { colors } = useTheme();
  // Видимость FAB считает чистая функция (`lib/fab-scroll`); экран только скармливает ей
  // смещение и раздаёт результат через контекст — сам `<Fab/>` в разметке не меняется.
  const [fabScroll, setFabScroll] = useState(initialFabScrollState);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setFabScroll((state) => nextFabScrollState(state, y));
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <AppHeader title={title} subtitle={subtitle} actions={actions} bell={bell} />
      {__DEV__ ? <DevBar /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, floatingAction ? styles.contentFab : null]}
          onScroll={floatingAction ? onScroll : undefined}
          // 16 мс — кадровый шаг; чаще считать направление незачем, реже — жест «запаздывает».
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, styles.content, floatingAction ? styles.contentFab : null]}>{children}</View>
      )}
      <FabVisibilityProvider value={fabScroll.visible}>{floatingAction}</FabVisibilityProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  // When a FAB overlays the body, reserve space so the last row clears it
  // (FAB bottom 24 + height 56 + breathing room).
  contentFab: { paddingBottom: 96 },
});
