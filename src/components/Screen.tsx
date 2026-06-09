import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { DevBar } from './DevBar';

export interface ScreenProps {
  title: string;
  children?: ReactNode;
  scroll?: boolean;
  /** Pinned overlay over the body (e.g. a <Fab/>) — sits in the FULL-HEIGHT safe area,
   *  not the scroll content, so it stays anchored above the tab bar regardless of scroll. */
  floatingAction?: ReactNode;
}

/** Themed tab-screen shell: safe-area + Phase-0 DevBar header + body + optional pinned FAB. */
export function Screen({ title, children, scroll = true, floatingAction }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <DevBar title={title} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, floatingAction ? styles.contentFab : null]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, styles.content, floatingAction ? styles.contentFab : null]}>{children}</View>
      )}
      {floatingAction}
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
