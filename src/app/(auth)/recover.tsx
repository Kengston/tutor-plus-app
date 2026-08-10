/**
 * «Восстановление доступа» (UI-v2 S17, spec 03 §3.3) — the three-step flow in one screen:
 * 1) contact → «Отправить код»; 2) the 6-cell code with «Отправить код повторно» / «Изменить
 * email или телефон» and an expiry («Код устарел. Запросите новый» after the demo TTL);
 * 3) the new password with the LIVE requirements checklist and the mismatch error. Against
 * the Phase-0 stub any 6-digit code passes; the final state says «Пароль изменён…» and
 * returns to the login screen.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { isStrongPassword, isValidCode, isValidContact, passwordChecks } from '@/lib/auth-validate';
import { useBack } from '@/lib/nav';
import { useTheme } from '@/theme';
import { Icon, Text, TextInput, type TextInputHandle } from '@/ui';

/** Demo code TTL — after this the step shows «Код устарел. Запросите новый». */
const CODE_TTL_MS = 60_000;

type Step = 'contact' | 'code' | 'password' | 'done';

export default function RecoverScreen() {
  const router = useRouter();
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();

  const [step, setStep] = useState<Step>('contact');
  const [contact, setContact] = useState('');
  const [contactErr, setContactErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [expired, setExpired] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [mismatch, setMismatch] = useState(false);

  // Tapping the visual cells refocuses the hidden input after the keyboard is dismissed.
  const codeInput = useRef<TextInputHandle>(null);

  // Expiry timer for the demo code (spec: «при истечении — Код устарел»).
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const armExpiry = () => {
    clearTimeout(timer.current);
    setExpired(false);
    timer.current = setTimeout(() => setExpired(true), CODE_TTL_MS);
  };

  const sendCode = () => {
    if (!isValidContact(contact)) {
      setContactErr(t('auth.errContact'));
      return;
    }
    setContactErr(null);
    setCode('');
    armExpiry();
    setStep('code');
  };

  const checks = passwordChecks(pw);
  const submitPassword = () => {
    if (pw !== pw2) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    if (!isStrongPassword(pw)) return;
    setStep('done');
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header
        title={step === 'code' ? t('auth.codeTitle') : step === 'password' ? t('auth.newPasswordTitle') : t('auth.recoverTitle')}
        onBack={() => (step === 'contact' || step === 'done' ? goBack() : setStep(step === 'code' ? 'contact' : 'code'))}
      />

      <View style={styles.content}>
        {step === 'contact' ? (
          <>
            <Text style={[styles.hint, { color: colors.body }]}>{t('auth.recoverHint')}</Text>
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
            <PrimaryBtn label={t('auth.sendCode')} onPress={sendCode} />
          </>
        ) : null}

        {step === 'code' ? (
          <>
            <Text style={[styles.hint, { color: colors.body }]}>{`${t('auth.codeSentTo')} ${contact.trim()}`}</Text>

            {/* Six code cells — one hidden input drives the six visual boxes. */}
            <Pressable
              onPress={() => codeInput.current?.focus()}
              accessibilityRole="button"
              accessibilityLabel={t('auth.codeTitle')}
              style={styles.cells}>
              {Array.from({ length: 6 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: colors.surface,
                      borderColor: i === code.length && !expired ? colors.primary : colors.hairline,
                      borderRadius: radius.control,
                    },
                  ]}>
                  <Text style={[styles.cellDigit, { color: colors.heading }]}>{code[i] ?? ''}</Text>
                </View>
              ))}
            </Pressable>
            <TextInput
              ref={codeInput}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
              accessibilityLabel={t('auth.codeTitle')}
              style={styles.hiddenInput}
            />

            {expired ? <Text style={[styles.err, { color: colors.danger }]}>{t('auth.codeExpired')}</Text> : null}

            <Pressable onPress={armExpiry} hitSlop={6} accessibilityRole="button" style={styles.linkRow}>
              <Text style={[styles.link, { color: colors.primaryDeep }]}>{t('auth.resendCode')}</Text>
            </Pressable>
            <Pressable onPress={() => setStep('contact')} hitSlop={6} accessibilityRole="button" style={styles.linkRow}>
              <Text style={[styles.link, { color: colors.primaryDeep }]}>{t('auth.changeContact')}</Text>
            </Pressable>

            <PrimaryBtn
              label={t('auth.continue')}
              disabled={!isValidCode(code) || expired}
              onPress={() => setStep('password')}
            />
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field }]}>
              <TextInput
                value={pw}
                onChangeText={setPw}
                placeholder={t('auth.newPassword')}
                placeholderTextColor={colors.stoneInactive}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel={t('auth.newPassword')}
                style={[styles.input, { color: colors.heading }]}
              />
            </View>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.surface, borderColor: mismatch ? colors.danger : colors.hairline, borderRadius: radius.field },
              ]}>
              <TextInput
                value={pw2}
                onChangeText={(v) => {
                  setPw2(v);
                  if (mismatch) setMismatch(false);
                }}
                placeholder={t('auth.repeatPassword')}
                placeholderTextColor={colors.stoneInactive}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel={t('auth.repeatPassword')}
                style={[styles.input, { color: colors.heading }]}
              />
            </View>
            {mismatch ? <Text style={[styles.err, { color: colors.danger }]}>{t('auth.errMismatch')}</Text> : null}

            {/* Live requirements checklist (spec §3.3). */}
            <View style={styles.reqs}>
              <Req ok={checks.length} label={t('auth.reqLength')} />
              <Req ok={checks.letter} label={t('auth.reqLetter')} />
              <Req ok={checks.digit} label={t('auth.reqDigit')} />
            </View>

            <PrimaryBtn label={t('common.save')} disabled={!isStrongPassword(pw)} onPress={submitPassword} />
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <View style={styles.doneWrap}>
              <Icon name="check" size={38} sw={2} stroke={colors.paid} />
              <Text style={[styles.doneText, { color: colors.heading }]}>{t('auth.passwordChanged')}</Text>
            </View>
            <PrimaryBtn label={t('auth.signIn')} onPress={() => router.replace('/login')} />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/** One live-checklist row: a check/neutral dot + the requirement. */
function Req({ ok, label }: { ok: boolean; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.reqRow}>
      <Icon name="check" size={15} sw={2.2} stroke={ok ? colors.paid : colors.stoneInactive} />
      <Text style={[styles.reqLabel, { color: ok ? colors.heading : colors.muted }]}>{label}</Text>
    </View>
  );
}

function PrimaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.submit,
        { backgroundColor: disabled ? colors.stoneLight : colors.primary, borderRadius: radius.field },
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.submitLabel, { color: disabled ? colors.stoneInactive : colors.onTint }]}>{label}</Text>
    </Pressable>
  );
}

/** Compact stack header — mirrors login.tsx. */
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

  hint: { fontSize: 14.5, lineHeight: 21 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
  err: { fontSize: 13, fontWeight: '500', paddingHorizontal: 2 },

  cells: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 6 },
  cell: {
    width: 46,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cellDigit: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hiddenInput: { position: 'absolute', opacity: 0.01, height: 1, width: 1 },

  linkRow: { alignSelf: 'flex-start', paddingVertical: 2 },
  link: { fontSize: 14, fontWeight: '600' },

  reqs: { gap: 8, paddingVertical: 4 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqLabel: { fontSize: 14, fontWeight: '500' },

  doneWrap: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  doneText: { fontSize: 15.5, fontWeight: '600', textAlign: 'center', lineHeight: 22 },

  submit: { height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitLabel: { fontSize: 15.5, fontWeight: '600' },

  pressed: { opacity: 0.85 },
});
