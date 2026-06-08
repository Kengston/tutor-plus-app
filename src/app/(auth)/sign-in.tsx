import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useAuth, type AuthMethod } from '@/lib/auth';
import { useTheme } from '@/theme';
import { Icon, type IconName } from '@/ui';

/**
 * Auth shell (ADR-0005 §2). Phase 0: the buttons drive a dev-stub sign-in;
 * real GoTrue (Apple / Google / email-phone OTP, SiwA on iOS) arrives in Phase 4.
 */
export default function SignIn() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const t = useT();

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: colors.accent }]}>
          <Icon name="sparkle" size={34} sw={1.8} stroke={colors.primaryDeep} />
        </View>
        <Text style={[styles.title, { color: colors.heading }]}>{t('auth.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{t('auth.subtitle')}</Text>
      </View>

      <View style={styles.actions}>
        <AuthButton variant="primary" icon="sparkle" label={t('auth.withApple')} onPress={() => signIn('apple')} />
        <AuthButton variant="outline" icon="sparkle" label={t('auth.withGoogle')} onPress={() => signIn('google')} />
        <View style={styles.dividerRow}>
          <View style={[styles.line, { backgroundColor: colors.hairline }]} />
          <Text style={[styles.or, { color: colors.label3 }]}>или</Text>
          <View style={[styles.line, { backgroundColor: colors.hairline }]} />
        </View>
        <AuthButton variant="outline" icon="message" label={t('auth.email')} onPress={() => signIn('email')} />
        <AuthButton variant="outline" icon="phone" label={t('auth.phone')} onPress={() => signIn('phone')} />
        <Pressable onPress={() => signIn('email')} style={styles.createBtn}>
          <Text style={[styles.createText, { color: colors.primary }]}>{t('auth.createAccount')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function AuthButton({
  variant,
  icon,
  label,
  onPress,
}: {
  variant: 'primary' | 'outline';
  icon: IconName;
  label: string;
  onPress: () => void;
}): ReactNode {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        primary
          ? { backgroundColor: colors.primary }
          : { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
        pressed ? { opacity: 0.85 } : null,
      ]}>
      <Icon name={icon} size={20} sw={1.8} stroke={primary ? colors.onTint : colors.heading} />
      <Text style={[styles.btnText, { color: primary ? colors.onTint : colors.heading }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  logo: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 15.5, textAlign: 'center', maxWidth: 280 },
  actions: { gap: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 16 },
  btnText: { fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontSize: 13 },
  createBtn: { alignItems: 'center', paddingVertical: 10 },
  createText: { fontSize: 15, fontWeight: '600' },
});
