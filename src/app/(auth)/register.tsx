/**
 * Registration WIZARD (UI-v2 S17, spec 03 §3.4 / ADR-0014) — «Шаг X из 5»:
 *   1. Учётные данные — name, contact, password (live checklist); the consent checkbox
 *      GATES «Создать аккаунт» (spec acceptance criterion).
 *   2. «Как вас зовут» — the display name.
 *   3. «Чем вы занимаетесь» — activity (spec-verbatim six, mapped onto the Activity union).
 *   4. «Как называть тех, с кем вы работаете» — Ученик / Клиент (the dual-mode axis).
 *   5. Значения по умолчанию + часовой пояс и напоминания — rate/duration/format (seeded
 *      into a new lesson, v11), the detected tz and the reminder lead.
 * The finish applies everything to the single profile row (context + DB, ADR-0013 C) and
 * signs in against the Phase-0 stub.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/db/hooks';
import { updateProfile } from '@/db/mutations';
import { DURATIONS, type Duration, type LessonFormat } from '@/domain/types';
import { activityDefaultClientType, useMode, useT, type Activity, type ClientType, type StringKey } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { isStrongPassword, isValidContact, passwordChecks } from '@/lib/auth-validate';
import { useBack } from '@/lib/nav';
import { useTheme } from '@/theme';
import { Icon, Segmented } from '@/ui';

const TOTAL_STEPS = 5;

/** Spec-verbatim activity labels (§3.4 шаг 3), mapped onto the Activity union. */
const ACTIVITIES: { key: Activity; label: StringKey }[] = [
  { key: 'teacher', label: 'activity.teacherFull' },
  { key: 'psychologist', label: 'activity.psychologist' },
  { key: 'coach', label: 'activity.coach' },
  { key: 'mentor', label: 'activity.mentorFull' },
  { key: 'trainer', label: 'activity.consultant' },
  { key: 'other', label: 'activity.otherFull' },
];

/** Reminder lead-times (reused from notification settings). */
const LEADS: { key: number; label: StringKey }[] = [
  { key: 10, label: 'lead.10' },
  { key: 20, label: 'lead.20' },
  { key: 60, label: 'lead.60' },
  { key: 1440, label: 'lead.1440' },
];

export default function RegisterScreen() {
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();
  const { signIn } = useAuth();
  const { setClientType } = useMode();
  const profile = useProfile();

  const [step, setStep] = useState(1);

  // Step 1 — credentials + consent.
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [contactErr, setContactErr] = useState<string | null>(null);

  // Steps 3–5 — profile choices.
  const [activity, setActivity] = useState<Activity>('teacher');
  const [clientType, setClientTypeLocal] = useState<ClientType>('Ученик');
  const [rate, setRate] = useState('1500');
  const [duration, setDuration] = useState<Duration>(60);
  const [format, setFormat] = useState<LessonFormat>('online');
  const [leadMin, setLeadMin] = useState(60);

  const checks = passwordChecks(password);
  const step1Valid = isValidContact(contact) && isStrongPassword(password) && agreed;

  const next = () => {
    if (step === 1 && !isValidContact(contact)) {
      setContactErr(t('auth.errContact'));
      return;
    }
    setContactErr(null);
    // Leaving step 3 presets the mode from the activity (ADR-0006 passport mapping);
    // the user can still override it on step 4.
    if (step === 3) pickClientType(activityDefaultClientType[activity]);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  /** Step-4 pick — local state AND the global context, so step-5 labels («Ставка за
   *  встречу») and the rest of the wizard follow the choice immediately (review fix S17). */
  const pickClientType = (next: ClientType) => {
    setClientTypeLocal(next);
    setClientType(next);
  };

  /** Finish: apply the wizard to the profile row + context, then sign in (Phase-0 stub). */
  const finish = async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
    setClientType(clientType); // instant lexicon app-wide (ADR-0006)
    if (profile) {
      await updateProfile(profile, {
        name: name.trim(),
        activity,
        clientType,
        tz,
        reminderLeadMin: leadMin,
        defaultRate: Number(rate) || null,
        defaultDuration: duration,
        defaultFormat: format,
      });
    }
    signIn('email');
  };

  const stepTitle =
    step === 1
      ? t('auth.createAccount')
      : step === 2
        ? t('auth.regNameTitle')
        : step === 3
          ? t('auth.regActivityTitle')
          : step === 4
            ? t('auth.regModeTitle')
            : t('auth.regDefaultsTitle');

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header
        title={stepTitle}
        subtitle={`${t('auth.stepOf')} ${step} ${t('common.of')} ${TOTAL_STEPS}`}
        onBack={() => (step === 1 ? goBack() : setStep((s) => s - 1))}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <>
            <Input value={name} onChange={setName} placeholder={t('auth.regName')} />
            <View>
              <Input
                value={contact}
                onChange={(v) => {
                  setContact(v);
                  if (contactErr) setContactErr(null);
                }}
                placeholder={t('auth.contactField')}
                email
                error={!!contactErr}
              />
              {contactErr ? <Text style={[styles.err, { color: colors.danger }]}>{contactErr}</Text> : null}
            </View>
            <Input value={password} onChange={setPassword} placeholder={t('auth.regPassword')} secure />

            {/* Live password checklist (same rules as recovery). */}
            <View style={styles.reqs}>
              <Req ok={checks.length} label={t('auth.reqLength')} />
              <Req ok={checks.letter} label={t('auth.reqLetter')} />
              <Req ok={checks.digit} label={t('auth.reqDigit')} />
            </View>

            {/* Consent — GATES the create button (spec §3.4-1). */}
            <Pressable
              onPress={() => setAgreed((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              style={({ pressed }) => [styles.agreeRow, pressed && styles.pressed]}>
              <View
                style={[
                  styles.checkbox,
                  { backgroundColor: agreed ? colors.primary : colors.surface, borderColor: colors.hairline, borderWidth: agreed ? 0 : 1.5 },
                ]}>
                {agreed ? <Icon name="check" size={15} sw={2.2} stroke={colors.onTint} /> : null}
              </View>
              <Text style={[styles.agreeText, { color: colors.body }]}>{t('auth.agree')}</Text>
            </Pressable>

            <PrimaryBtn label={t('auth.createAccount')} disabled={!step1Valid} onPress={next} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[styles.hint, { color: colors.muted }]}>{t('auth.regNameHint')}</Text>
            <Input value={name} onChange={setName} placeholder={t('auth.regName')} />
            <PrimaryBtn label={t('auth.next')} disabled={name.trim().length === 0} onPress={next} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={[styles.hint, { color: colors.muted }]}>{t('auth.regActivityHint')}</Text>
            <View style={styles.options}>
              {ACTIVITIES.map(({ key, label }) => {
                const on = key === activity;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setActivity(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: on ? colors.primaryVlight : colors.surface,
                        borderColor: on ? colors.primary : colors.hairline,
                        borderRadius: radius.field,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.optionLabel, { color: on ? colors.heading : colors.body }]}>{t(label)}</Text>
                    {on ? <Icon name="check" size={17} sw={2.1} stroke={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <PrimaryBtn label={t('auth.next')} onPress={next} />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Segmented
              tabs={[t('mode.student'), t('mode.client')]}
              active={clientType === 'Ученик' ? t('mode.student') : t('mode.client')}
              onChange={(tab) => pickClientType(tab === t('mode.student') ? 'Ученик' : 'Клиент')}
            />
            <PrimaryBtn label={t('auth.next')} onPress={next} />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <Text style={[styles.hint, { color: colors.muted }]}>{t('auth.regDefaultsHint')}</Text>

            <Text style={[styles.groupLabel, { color: colors.muted }]}>{t('auth.defRate')}</Text>
            <Input value={rate} onChange={(v) => setRate(v.replace(/\D/g, ''))} placeholder="1500" numeric />

            <Text style={[styles.groupLabel, { color: colors.muted }]}>{t('auth.defDuration')}</Text>
            <Segmented
              tabs={DURATIONS.map((d) => `${d} ${t('common.min')}`)}
              active={`${duration} ${t('common.min')}`}
              onChange={(tab) => {
                const d = DURATIONS.find((x) => `${x} ${t('common.min')}` === tab);
                if (d) setDuration(d);
              }}
            />

            <Text style={[styles.groupLabel, { color: colors.muted }]}>{t('auth.defFormat')}</Text>
            <Segmented
              tabs={[t('format.online'), t('format.inperson')]}
              active={format === 'online' ? t('format.online') : t('format.inperson')}
              onChange={(tab) => setFormat(tab === t('format.online') ? 'online' : 'inperson')}
            />

            {/* Часовой пояс + напоминания (issue: последний шаг мастера). */}
            <Text style={[styles.groupLabel, { color: colors.muted }]}>{t('settings.tz')}</Text>
            <View style={[styles.tzRow, { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radius.field }]}>
              <Text style={[styles.tzText, { color: colors.heading }]}>
                {Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'}
              </Text>
            </View>

            <Text style={[styles.groupLabel, { color: colors.muted }]}>{t('nset.leadTime')}</Text>
            <Segmented
              tabs={LEADS.map((x) => t(x.label))}
              active={t(LEADS.find((x) => x.key === leadMin)?.label ?? 'lead.60')}
              onChange={(tab) => {
                const next = LEADS.find((x) => t(x.label) === tab);
                if (next) setLeadMin(next.key);
              }}
            />

            <PrimaryBtn label={t('common.done')} onPress={() => void finish()} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  secure,
  numeric,
  email,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  numeric?: boolean;
  /** Contact field — e-mail keyboard + no auto-capitalization. */
  email?: boolean;
  error?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.inputRow,
        { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.hairline, borderRadius: radius.field },
      ]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.stoneInactive}
        secureTextEntry={secure}
        keyboardType={numeric ? 'number-pad' : email ? 'email-address' : 'default'}
        autoCapitalize={secure || numeric || email ? 'none' : 'words'}
        accessibilityLabel={placeholder}
        style={[styles.input, { color: colors.heading }]}
      />
    </View>
  );
}

/** One live-checklist row (mirrors recover.tsx). */
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

/** Compact stack header with the «Шаг X из Y» subtitle. */
function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
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
      <View style={styles.headerBody}>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.heading }]}>
          {title}
        </Text>
        <Text style={[styles.headerStep, { color: colors.muted }]}>{subtitle}</Text>
      </View>
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
  headerBody: { flex: 1, minWidth: 0, gap: 2 },
  headerTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  headerStep: { fontSize: 12.5, fontWeight: '500' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 12 },

  hint: { fontSize: 14, lineHeight: 20 },
  groupLabel: { fontSize: 13, fontWeight: '500', marginTop: 4 },

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

  reqs: { gap: 8, paddingVertical: 2 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqLabel: { fontSize: 14, fontWeight: '500' },

  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  agreeText: { flex: 1, fontSize: 13.5, lineHeight: 19 },

  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: { fontSize: 15, fontWeight: '500' },

  tzRow: { height: 52, justifyContent: 'center', paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
  tzText: { fontSize: 15, fontWeight: '600' },

  submit: { height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitLabel: { fontSize: 15.5, fontWeight: '600' },

  pressed: { opacity: 0.85 },
});
