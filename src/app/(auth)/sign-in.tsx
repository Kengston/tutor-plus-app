/**
 * Auth START screen (UI-v2 S17, spec 03 §3.1 / ADR-0014) — the prototype logo (T+ mark, not
 * the sparkle), «Tutor+» + subtitle, then the spec button order: «Войти» (primary, dark) →
 * «Создать аккаунт» (outline) → «или» → «Продолжить с Apple / Google» (brand glyphs). Social
 * taps open the DEMO dialog («Это демонстрационный переход») — real GoTrue lands in Phase 4;
 * «Продолжить» signs in against the Phase-0 stub.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme';
import { Sheet } from '@/ui';

/**
 * The prototype's T+ logo mark (crossbar + stem + the accent swoosh and dot).
 * The mark is brand-frozen as a WHOLE — glyphs and plaque keep the prototype hexes in both
 * themes; a theme-driven plaque would render the gold swoosh gold-on-gold in «Вечер».
 */
const LOGO_PLAQUE = '#151E2D';

function LogoMark() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
      <Path d="M9 11.5h18" stroke="#FFFDF7" strokeWidth={3.2} strokeLinecap="round" />
      <Path d="M18 11.5V26" stroke="#FFFDF7" strokeWidth={3.2} strokeLinecap="round" />
      <Path
        d="M11 24.5c3.5 0 5.5-4 7.2-7 1.6-2.8 3.4-6 6.8-6"
        stroke="#FFD364"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={25.8} cy={11.2} r={2.4} fill="#FFD364" />
    </Svg>
  );
}

/** Apple brand glyph (prototype path). */
function AppleMark({ color }: { color: string }) {
  return (
    <Svg width={18} height={20} viewBox="0 0 18 20" fill={color}>
      <Path d="M14.6 10.6c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.6 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7c1.2 0 1.9-1 2.6-2.1.8-1.2 1.2-2.3 1.2-2.4-.1 0-2.2-.9-2.2-3.4z" />
      <Path d="M12.4 4.1c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 2-.5 2.5-1.2z" />
    </Svg>
  );
}

/** Google brand glyph (prototype path, theme-neutral greys). */
function GoogleMark({ strong, soft }: { strong: string; soft: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21.6 12.2c0-.7-.06-1.2-.18-1.8H12v3.4h5.4c-.1.9-.7 2.2-1.9 3.1l2.9 2.3c1.7-1.6 2.7-4 2.7-7z" fill={strong} />
      <Path d="M12 22c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8l-3 2.3C5.4 19.8 8.5 22 12 22z" fill={strong} />
      <Path d="M6.9 13.6c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6L3.9 8C3.3 9.2 3 10.6 3 12s.3 2.8.9 4l3-2.4z" fill={soft} />
      <Path d="M12 6.6c1.3 0 2.2.6 2.7 1.1l2.6-2.5C15.8 3.7 13.7 3 12 3 8.5 3 5.4 5.2 3.9 8l3 2.4c.7-2.2 2.7-3.8 5.1-3.8z" fill={strong} />
    </Svg>
  );
}

export default function StartScreen() {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const { signIn } = useAuth();
  const t = useT();

  // Social demo dialog (spec §3.1): which provider was tapped, or null.
  const [social, setSocial] = useState<'apple' | 'google' | null>(null);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: LOGO_PLAQUE }]}>
          <LogoMark />
        </View>
        <Text style={[styles.title, { color: colors.heading }]}>{t('auth.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.body }]}>{t('auth.subtitle')}</Text>
      </View>

      {/* Button order per spec §3.1: Войти → Создать аккаунт → или → Apple → Google. */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/login')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, borderRadius: radius.field },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.btnLabel, { color: colors.onTint }]}>{t('auth.signIn')}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/register')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.btn,
            styles.btnOutline,
            { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.btnLabel, { color: colors.heading }]}>{t('auth.createAccount')}</Text>
        </Pressable>

        <View style={styles.orRow}>
          <View style={[styles.orLine, { backgroundColor: colors.hairline }]} />
          <Text style={[styles.orText, { color: colors.muted }]}>{t('auth.or')}</Text>
          <View style={[styles.orLine, { backgroundColor: colors.hairline }]} />
        </View>

        <Pressable
          onPress={() => setSocial('apple')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.btn,
            styles.btnOutline,
            styles.btnSocial,
            { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field },
            pressed && styles.pressed,
          ]}>
          <AppleMark color={colors.heading} />
          <Text style={[styles.btnLabel, { color: colors.heading }]}>{t('auth.withApple')}</Text>
        </Pressable>

        <Pressable
          onPress={() => setSocial('google')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.btn,
            styles.btnOutline,
            styles.btnSocial,
            { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field },
            pressed && styles.pressed,
          ]}>
          <GoogleMark strong={colors.stone700} soft={colors.stoneInactive} />
          <Text style={[styles.btnLabel, { color: colors.heading }]}>{t('auth.withGoogle')}</Text>
        </Pressable>
      </View>

      {/* Social demo dialog (spec §3.1) — «Продолжить» signs in against the stub. */}
      {social ? (
        <Sheet title={social === 'apple' ? t('auth.withApple') : t('auth.withGoogle')} onClose={() => setSocial(null)}>
          <Text style={[styles.demoText, { color: colors.body }]}>{t('auth.socialDemo')}</Text>
          <View style={styles.demoActions}>
            <Pressable
              onPress={() => setSocial(null)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.demoBtn,
                { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.demoBtnLabel, { color: colors.body }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSocial(null);
                signIn(social);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.demoBtn,
                { backgroundColor: colors.primary, borderRadius: radius.field },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.demoBtnLabel, { color: colors.onTint }]}>{t('auth.continue')}</Text>
            </Pressable>
          </View>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 30, fontWeight: '600', letterSpacing: -0.6 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },

  actions: { gap: 10, paddingBottom: 28 },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: StyleSheet.hairlineWidth },
  btnSocial: { flexDirection: 'row', gap: 10 },
  btnLabel: { fontSize: 15.5, fontWeight: '600' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 13, fontWeight: '500' },

  demoText: { fontSize: 14.5, lineHeight: 20, marginBottom: 16 },
  demoActions: { flexDirection: 'row', gap: 10 },
  demoBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  demoBtnLabel: { fontSize: 15, fontWeight: '600' },

  pressed: { opacity: 0.85 },
});
