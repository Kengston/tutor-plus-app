import '@/lib/silence-rnw-warnings';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { seedIfEmpty } from '@/db/seed';
import { DualModeProvider } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider as TutorThemeProvider, useTheme, useThemeMode } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    // Seed dev data once on first launch (no-op if data exists). Phase 1: web/LokiJS.
    seedIfEmpty().catch((e) => console.error('[db] seed failed', e));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TutorThemeProvider>
          <DualModeProvider>
            <AuthProvider>
              <NavigationRoot />
            </AuthProvider>
          </DualModeProvider>
        </TutorThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Auth gate (ADR-0005 §2): redirect unauthenticated users to the sign-in flow. */
function useAuthGate() {
  const { session } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) router.replace('/sign-in');
    else if (session && inAuthGroup) router.replace('/');
  }, [session, segments, router]);
}

function NavigationRoot() {
  const { colors, scheme } = useTheme();
  useThemeMode(); // subscribe so the nav theme updates on toggle
  useAuthGate();

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.surface,
      text: colors.heading,
      border: colors.hairline,
      notification: colors.danger,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="student" />
        <Stack.Screen name="lesson" />
        <Stack.Screen name="gallery" options={{ presentation: 'modal', headerShown: true, title: 'UI kit' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
