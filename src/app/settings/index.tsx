/**
 * Settings HOME (UI-v2 S15, spec 10 §10.1) — the flat Phase-3 screen became a sectioned hub:
 * a profile card on top (avatar, name, activity, «Редактировать профиль») and grouped rows
 * that push DEDICATED sub-screens: «Профиль и аккаунт» → security; «Работа» → schedule /
 * notifications / payment; «Оформление» → theme; «Данные и поддержка» → export, backup,
 * help, documents. «Выйти из аккаунта» works against the Phase-0 auth stub; «Удалить аккаунт»
 * asks for confirmation first. All values shown in rows are LIVE (profile row / theme mode).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { database } from '@/db';
import { useProfile } from '@/db/hooks';
import type { ProfileModel } from '@/db/models';
import { useT, type StringKey } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { initialsOf } from '@/lib/format';
import { nowMs } from '@/lib/time';
import { useTheme, useThemeMode } from '@/theme';
import { Card, CatAvatar, Icon, SectionLabel, Sheet, type IconName } from '@/ui';

import { useBack } from '@/lib/nav';
import { WORK_DAY_KEYS, workDaysLabel } from '@/lib/work-days';

export default function SettingsScreen() {
  const profile = useProfile();
  if (!profile) return null; // brief null splash; ProfileGate already gated launch
  return <SettingsHome profile={profile} />;
}

function SettingsHome({ profile }: { profile: ProfileModel }) {
  const router = useRouter();
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();
  const { mode: themeMode } = useThemeMode();
  const { signOut } = useAuth();

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const activityLabel = t(`activity.${profile.activity}` as StringKey);
  const themeLabel =
    themeMode === 'system' ? t('settings.themeSystem') : themeMode === 'light' ? t('settings.themeLight') : t('settings.themeDark');
  const notifValue = profile.notifEnabled !== false ? t('set.on') : t('set.off');
  const workDaysValue = workDaysLabel(profile.workDays, (k) => t(WORK_DAY_KEYS[k]));

  /** Sign out against the Phase-0 stub — the auth gate returns the user to the start screen. */
  const doSignOut = () => {
    signOut();
    router.replace('/sign-in');
  };

  /** Delete the account: honour the confirmation copy — wipe the LOCAL database (the only
   *  store there is pre-sync), then sign out. A fresh sign-in reseeds the demo data. */
  const doDeleteAccount = async () => {
    await database.write(() => database.unsafeResetDatabase());
    doSignOut();
  };

  // «Резервная копия» date (spec §10.1 — «с датой»): the local DB persists continuously,
  // so today is the honest timestamp until real sync backups (Phase 4).
  const bd = new Date(nowMs());
  const backupDate = `${bd.getDate()} ${t(`monthGen.${bd.getMonth()}` as StringKey)}`;

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('settings.title')} onBack={() => goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Profile card: avatar · name · activity · edit (spec 10 §10.1) ── */}
        <Card style={styles.profileCard}>
          {/* No name yet (signed in against an account that never went through the wizard):
              invite the user to add one instead of showing a dash (TP-FIX-0719, п. 4). */}
          <CatAvatar initials={profile.name ? initialsOf(profile.name) : '+'} cat="slate" size={52} />
          <View style={styles.profileBody}>
            <Text
              numberOfLines={1}
              style={[styles.profileName, { color: profile.name ? colors.heading : colors.muted }]}>
              {profile.name || t('set.namePlaceholder')}
            </Text>
            <Text numberOfLines={1} style={[styles.profileActivity, { color: colors.muted }]}>
              {activityLabel}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/settings/edit')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('set.editProfile')}
            style={({ pressed }) => [styles.editBtn, { backgroundColor: colors.stoneLight }, pressed && styles.pressed]}>
            <Icon name="edit" size={17} sw={1.8} stroke={colors.heading} />
          </Pressable>
        </Card>

        {/* ── «Профиль и аккаунт» ── */}
        <View>
          <SectionLabel>{t('set.profileAccount')}</SectionLabel>
          <Card style={styles.card}>
            <NavRow icon="eye" label={t('set.security')} onPress={() => router.push('/settings/security')} />
          </Card>
        </View>

        {/* ── «Работа»: расписание · уведомления · оплата и валюта ── */}
        <View>
          <SectionLabel>{t('set.work')}</SectionLabel>
          <Card style={styles.card}>
            <NavRow icon="calendar" label={t('set.scheduleRow')} value={workDaysValue} onPress={() => router.push('/settings/schedule')} />
            <Hairline />
            <NavRow icon="bell" label={t('set.notifRow')} value={notifValue} onPress={() => router.push('/notification-settings')} />
            <Hairline />
            <NavRow icon="wallet" label={t('set.payment')} value={t('set.currencyRub')} onPress={() => router.push('/settings/payment')} />
          </Card>
        </View>

        {/* ── «Оформление» ── */}
        <View>
          <SectionLabel>{t('settings.appearance')}</SectionLabel>
          <Card style={styles.card}>
            <NavRow icon="sun" label={t('set.themeRow')} value={themeLabel} onPress={() => router.push('/settings/appearance')} />
          </Card>
        </View>

        {/* ── «Данные и поддержка» — четыре пункта (spec 10 §10.1) ── */}
        <View>
          <SectionLabel>{t('set.dataSupport')}</SectionLabel>
          <Card style={styles.card}>
            <NavRow icon="download" label={t('set.export')} onPress={() => router.push('/settings/data')} />
            <Hairline />
            <NavRow icon="refresh" label={t('settings.backup')} value={backupDate} onPress={() => router.push('/settings/data')} />
            <Hairline />
            <NavRow icon="info" label={t('set.help')} onPress={() => router.push('/settings/data')} />
            <Hairline />
            <NavRow icon="link" label={t('set.documents')} onPress={() => router.push('/settings/data')} />
          </Card>
        </View>

        {/* ── Выход + удаление (с подтверждением) ── */}
        <View style={styles.dangerBlock}>
          <Pressable
            onPress={doSignOut}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.signOut,
              { backgroundColor: colors.stoneLight, borderRadius: radius.field },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.signOutLabel, { color: colors.body }]}>{t('set.signOut')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setDeleteConfirm(true)}
            accessibilityRole="button"
            hitSlop={6}
            style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}>
            <Text style={[styles.deleteLabel, { color: colors.danger }]}>{t('set.deleteAccount')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete-account confirmation (spec 10 §10.1 — «с подтверждением»). Stub: signs out. */}
      {deleteConfirm ? (
        <Sheet title={t('set.deleteAccount')} onClose={() => setDeleteConfirm(false)}>
          <Text style={[styles.confirmText, { color: colors.body }]}>{t('set.deleteConfirm')}</Text>
          <View style={styles.confirmActions}>
            <Pressable
              onPress={() => setDeleteConfirm(false)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: colors.stoneLight, borderRadius: radius.field },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.confirmBtnLabel, { color: colors.body }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void doDeleteAccount()}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: colors.danger, borderRadius: radius.field },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.confirmBtnLabel, { color: colors.onTint }]}>{t('set.delete')}</Text>
            </Pressable>
          </View>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

/** A section row: icon · label · live value · chevron → pushes its sub-screen. */
function NavRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}>
      <Icon name={icon} size={19} sw={1.7} stroke={colors.stoneInactive} />
      <Text numberOfLines={1} style={[styles.navLabel, { color: colors.heading }]}>
        {label}
      </Text>
      {value ? (
        <Text numberOfLines={1} style={[styles.navValue, { color: colors.muted }]}>
          {value}
        </Text>
      ) : null}
      <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
    </Pressable>
  );
}

/** Compact stack header (this stack has headerShown:false) — mirrors finance/[id].tsx. */
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

  // profile card
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14 },
  profileBody: { flex: 1, minWidth: 0, gap: 3 },
  profileName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  profileActivity: { fontSize: 13.5, fontWeight: '500' },
  editBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // section cards + rows
  card: { paddingHorizontal: 14 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  navLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  navValue: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  hairline: { height: StyleSheet.hairlineWidth },

  // sign out + delete
  dangerBlock: { gap: 10, marginTop: 4 },
  signOut: { height: 50, alignItems: 'center', justifyContent: 'center' },
  signOutLabel: { fontSize: 15, fontWeight: '600' },
  deleteRow: { alignItems: 'center', paddingVertical: 8 },
  deleteLabel: { fontSize: 14, fontWeight: '600' },

  // delete confirmation
  confirmText: { fontSize: 14.5, lineHeight: 20, marginBottom: 16 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  confirmBtnLabel: { fontSize: 15, fontWeight: '600' },

  pressed: { opacity: 0.85 },
});
