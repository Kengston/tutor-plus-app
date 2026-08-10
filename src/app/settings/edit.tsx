/**
 * Profile editing (UI-v2 S15, spec 10 §10.2): «Имя и фамилия», «Тип деятельности» (6 вариантов),
 * «Кого вы ведёте» (Ученик/Клиент — instant lexicon switch app-wide + persisted), «Телефон /
 * мессенджер» (v9 column), «Часовой пояс» (informational, ADR-0005). Writes go DB→context
 * one-way (ADR-0013 C): mode changes hit BOTH the context setter (instant) and the row.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/db/hooks';
import type { ProfileModel } from '@/db/models';
import { updateProfile } from '@/db/mutations';
import { useMode, useT, type Activity, type ClientType, type StringKey } from '@/i18n';
import { useBack } from '@/lib/nav';
import { useTheme } from '@/theme';
import { Card, Icon, SectionLabel, Segmented, Sheet } from '@/ui';

/** Activities offered in the picker (spec 10 §10.2 — 6 вариантов), labels via i18n `activity.*`. */
const ACTIVITIES: { key: Activity; label: StringKey }[] = [
  { key: 'teacher', label: 'activity.teacher' },
  { key: 'psychologist', label: 'activity.psychologist' },
  { key: 'coach', label: 'activity.coach' },
  { key: 'mentor', label: 'activity.mentor' },
  { key: 'trainer', label: 'activity.trainer' },
  { key: 'other', label: 'activity.other' },
];

export default function ProfileEditScreen() {
  const profile = useProfile();
  if (!profile) return null;
  return <ProfileEditForm profile={profile} />;
}

function ProfileEditForm({ profile }: { profile: ProfileModel }) {
  const goBack = useBack();
  const t = useT();
  const { colors } = useTheme();
  const { clientType, setClientType } = useMode();

  const [activityPicker, setActivityPicker] = useState(false);
  // Local buffers for smooth typing; persisted on each change (cheap single-row writes).
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');

  const onChangeName = (next: string) => {
    setName(next);
    void updateProfile(profile, { name: next });
  };
  const onChangePhone = (next: string) => {
    setPhone(next);
    void updateProfile(profile, { phone: next || null });
  };

  /** Switch dual-mode lexicon: context setter (instant, app-wide) AND the row (survives reload). */
  const pickClientType = (next: ClientType) => {
    setClientType(next);
    void updateProfile(profile, { clientType: next });
  };

  const activityLabel = ACTIVITIES.find((a) => a.key === profile.activity)?.label ?? 'activity.teacher';

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('set.editTitle')} onBack={() => goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          {/* Имя и фамилия */}
          <View style={styles.pickRow}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('set.nameField')}</Text>
            <TextInput
              value={name}
              onChangeText={onChangeName}
              placeholder={t('set.nameField')}
              placeholderTextColor={colors.stoneInactive}
              accessibilityLabel={t('set.nameField')}
              style={[styles.textInput, { color: colors.heading }]}
            />
          </View>

          <Hairline />

          {/* Тип деятельности — Sheet picker (6 вариантов). */}
          <Pressable
            onPress={() => setActivityPicker(true)}
            style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('settings.activity')}</Text>
            <Text numberOfLines={1} style={[styles.rowValue, { color: colors.heading }]}>
              {t(activityLabel)}
            </Text>
            <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
          </Pressable>

          <Hairline />

          {/* Телефон / мессенджер (v9). */}
          <View style={styles.pickRow}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('set.phoneMessenger')}</Text>
            <TextInput
              value={phone}
              onChangeText={onChangePhone}
              keyboardType="phone-pad"
              placeholder={t('finance.optional')}
              placeholderTextColor={colors.stoneInactive}
              accessibilityLabel={t('set.phoneMessenger')}
              style={[styles.textInput, { color: colors.heading }]}
            />
          </View>

          <Hairline />

          {/* Часовой пояс — informational (ADR-0005; editable with sync, Phase 4). */}
          <View style={styles.pickRow}>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('settings.tz')}</Text>
            <Text numberOfLines={1} style={[styles.rowValue, { color: colors.heading }]}>
              {profile.tz}
            </Text>
          </View>
        </Card>

        {/* «Кого вы ведёте» — the dual-mode axis with the spec's reassurance line. */}
        <View>
          <SectionLabel>{t('set.whoYouLead')}</SectionLabel>
          <Text style={[styles.hint, { color: colors.muted }]}>{t('set.whoHint')}</Text>
          <Segmented
            tabs={[t('mode.student'), t('mode.client')]}
            active={clientType === 'Ученик' ? t('mode.student') : t('mode.client')}
            onChange={(tab) => pickClientType(tab === t('mode.student') ? 'Ученик' : 'Клиент')}
          />
        </View>
      </ScrollView>

      {activityPicker ? (
        <Sheet title={t('settings.activity')} onClose={() => setActivityPicker(false)}>
          <Card>
            {ACTIVITIES.map(({ key, label }, i) => {
              const on = key === profile.activity;
              return (
                <View key={key}>
                  {i > 0 ? <Hairline /> : null}
                  <Pressable
                    onPress={() => {
                      void updateProfile(profile, { activity: key });
                      setActivityPicker(false);
                    }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      on && { backgroundColor: colors.primaryVlight },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.optionLabel, { color: colors.heading }]}>{t(label)}</Text>
                    {on ? <Icon name="check" size={18} sw={2} stroke={colors.primary} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

/** Compact stack header — mirrors settings/index.tsx. */
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

function Hairline() {
  const { colors } = useTheme();
  return <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />;
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
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 18 },

  card: { paddingHorizontal: 14 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowLabel: { fontSize: 14, fontWeight: '500', flexShrink: 0 },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600' },
  textInput: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  hint: { fontSize: 13, fontWeight: '500', marginTop: -4, marginBottom: 4, paddingHorizontal: 2 },
  hairline: { height: StyleSheet.hairlineWidth },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  optionLabel: { fontSize: 15, fontWeight: '500' },

  pressed: { opacity: 0.85 },
});
