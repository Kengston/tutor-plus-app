/**
 * «Вход и безопасность» (UI-v2 S15, spec 10 §10.2) — the UI SCAFFOLD: «Изменить пароль»,
 * «Подключенные способы входа» (Apple / Google with a connection state), «Выйти на всех
 * устройствах». Server actions land with real auth (Phase 4, ADR-0014) — rows that need a
 * backend show the «Скоро» chip; the sign-out-everywhere works against the Phase-0 stub.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useBack } from '@/lib/nav';
import { useTheme } from '@/theme';
import { Card, Chip, Icon, SectionLabel } from '@/ui';

export default function SecurityScreen() {
  const router = useRouter();
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();
  const { signOut } = useAuth();

  const signOutEverywhere = () => {
    signOut();
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('set.security')} onBack={() => goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          {/* Изменить пароль — backend lands in Phase 4 (ADR-0014). */}
          <View style={[styles.row, styles.deferred]}>
            <Icon name="eyeOff" size={19} sw={1.7} stroke={colors.stoneInactive} />
            <Text style={[styles.rowLabel, { color: colors.heading }]}>{t('set.changePassword')}</Text>
            <Chip tone="neutral">{t('settings.soon')}</Chip>
          </View>
        </Card>

        {/* Подключенные способы входа — states are honest stubs until GoTrue (Phase 4). */}
        <View>
          <SectionLabel>{t('set.connectedLogins')}</SectionLabel>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Icon name="sparkle" size={19} sw={1.7} stroke={colors.stoneInactive} />
              <Text style={[styles.rowLabel, { color: colors.heading }]}>Apple</Text>
              <Text style={[styles.stateLabel, { color: colors.muted }]}>{t('set.notConnected')}</Text>
            </View>
            <Hairline />
            <View style={styles.row}>
              <Icon name="sparkle" size={19} sw={1.7} stroke={colors.stoneInactive} />
              <Text style={[styles.rowLabel, { color: colors.heading }]}>Google</Text>
              <Text style={[styles.stateLabel, { color: colors.muted }]}>{t('set.notConnected')}</Text>
            </View>
          </Card>
        </View>

        {/* Выйти на всех устройствах — against the stub (single device today). */}
        <Pressable
          onPress={signOutEverywhere}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.signOutAll,
            { backgroundColor: colors.stoneLight, borderRadius: radius.field },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.signOutAllLabel, { color: colors.body }]}>{t('set.signOutAll')}</Text>
        </Pressable>
      </ScrollView>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  stateLabel: { fontSize: 14, fontWeight: '500' },
  deferred: { opacity: 0.7 },
  hairline: { height: StyleSheet.hairlineWidth },

  signOutAll: { height: 50, alignItems: 'center', justifyContent: 'center' },
  signOutAllLabel: { fontSize: 15, fontWeight: '600' },

  pressed: { opacity: 0.85 },
});
