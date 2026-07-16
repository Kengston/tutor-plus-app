/**
 * «Вход» (UI-v2 S17, spec 03 §3.2) — contact + password with show/hide, «Забыли пароль?»,
 * spec-verbatim validation errors. Against the Phase-0 stub any VALID pair signs in; the
 * «Неверный email или пароль» error is reserved for the real backend (Phase 4, ADR-0014).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { isValidContact } from '@/lib/auth-validate';
import { useTheme } from '@/theme';
import { Icon } from '@/ui';

export default function LoginScreen() {
  const router = useRouter();
  const t = useT();
  const { colors, radius } = useTheme();
  const { signIn } = useAuth();

  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  // Errors surface on submit, not per keystroke (spec errors are momentary, not nagging).
  const [contactErr, setContactErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  const submit = () => {
    const cErr = isValidContact(contact) ? null : t('auth.errContact');
    const pErr = password.length > 0 ? null : t('auth.errPasswordEmpty');
    setContactErr(cErr);
    setPasswordErr(pErr);
    if (cErr || pErr) return;
    signIn('email'); // Phase-0 stub: a valid pair signs in
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('auth.loginTitle')} onBack={() => router.back()} />

      <View style={styles.content}>
        {/* Email или телефон */}
        <View>
          <View
            style={[
              styles.inputRow,
              { backgroundColor: colors.surface, borderColor: contactErr ? colors.danger : colors.hairline, borderRadius: radius.field },
            ]}>
            <TextInput
              value={contact}
              onChangeText={(v) => {
                setContact(v);
                if (contactErr) setContactErr(null);
              }}
              placeholder={t('auth.contactField')}
              placeholderTextColor={colors.stoneInactive}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel={t('auth.contactField')}
              style={[styles.input, { color: colors.heading }]}
            />
          </View>
          {contactErr ? <Text style={[styles.err, { color: colors.danger }]}>{contactErr}</Text> : null}
        </View>

        {/* Пароль + показать/скрыть */}
        <View>
          <View
            style={[
              styles.inputRow,
              { backgroundColor: colors.surface, borderColor: passwordErr ? colors.danger : colors.hairline, borderRadius: radius.field },
            ]}>
            <TextInput
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (passwordErr) setPasswordErr(null);
              }}
              placeholder={t('auth.passwordField')}
              placeholderTextColor={colors.stoneInactive}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              accessibilityLabel={t('auth.passwordField')}
              style={[styles.input, { color: colors.heading }]}
            />
            <Pressable
              onPress={() => setShowPw((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPw ? t('auth.hidePassword') : t('auth.showPassword')}>
              <Icon name={showPw ? 'eyeOff' : 'eye'} size={19} sw={1.7} stroke={colors.muted} />
            </Pressable>
          </View>
          {passwordErr ? <Text style={[styles.err, { color: colors.danger }]}>{passwordErr}</Text> : null}
        </View>

        <Pressable onPress={() => router.push('/recover')} hitSlop={6} accessibilityRole="button" style={styles.forgotRow}>
          <Text style={[styles.forgot, { color: colors.primaryDeep }]}>{t('auth.forgot')}</Text>
        </Pressable>

        <Pressable
          onPress={submit}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: colors.primary, borderRadius: radius.field },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.submitLabel, { color: colors.onTint }]}>{t('auth.signIn')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Compact stack header — mirrors the pushed-screen idiom. */
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={title}>
        <Icon name="back" size={20} stroke={colors.heading} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.heading }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
  err: { fontSize: 13, fontWeight: '500', marginTop: 6, paddingHorizontal: 2 },

  forgotRow: { alignSelf: 'flex-start', paddingVertical: 2 },
  forgot: { fontSize: 14, fontWeight: '600' },

  submit: { height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitLabel: { fontSize: 15.5, fontWeight: '600' },

  pressed: { opacity: 0.85 },
});
