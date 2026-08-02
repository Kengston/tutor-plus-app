/**
 * «Расписание» — working days (UI-v2 S15, spec 10 §10.1): seven weekday chips toggle the
 * profile's `work_days` CSV (v9; null reads as Пн–Пт via lib/work-days). The picked set
 * labels the settings-home row («Пн–Пт» / «Пн, Ср, Пт»).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '@/db/hooks';
import { updateProfile } from '@/db/mutations';
import { useT } from '@/i18n';
import { useBack } from '@/lib/nav';
import { parseWorkDays, serializeWorkDays, WORK_DAY_KEYS, WORK_DAY_ORDER, workDaysLabel } from '@/lib/work-days';
import { useTheme } from '@/theme';
import { Card, Icon, SectionLabel } from '@/ui';

export default function WorkScheduleScreen() {
  const goBack = useBack();
  const t = useT();
  const { colors, radius } = useTheme();
  const profile = useProfile();

  if (!profile) return null;

  const days = parseWorkDays(profile.workDays);
  const toggle = (day: number) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    if (next.length === 0) return; // at least one working day stays picked
    void updateProfile(profile, { workDays: serializeWorkDays(next) });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Header title={t('set.scheduleRow')} onBack={() => goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <SectionLabel>{t('set.workDays')}</SectionLabel>
          <Text style={[styles.hint, { color: colors.muted }]}>{t('set.workDaysHint')}</Text>
          <View style={styles.chips}>
            {WORK_DAY_ORDER.map((day) => {
              const on = days.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggle(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: on ? colors.primaryVlight : colors.surface,
                      borderColor: on ? colors.primary : colors.hairline,
                      borderRadius: radius.pill,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.chipLabel, { color: on ? colors.primary : colors.body }]}>
                    {t(WORK_DAY_KEYS[day])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Live preview of the label the settings home shows. */}
        <Card style={styles.previewCard}>
          <Text style={[styles.previewLabel, { color: colors.muted }]}>{t('set.workDays')}</Text>
          <Text style={[styles.previewValue, { color: colors.heading }]}>
            {workDaysLabel(profile.workDays, (k) => t(WORK_DAY_KEYS[k]))}
          </Text>
        </Card>
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

  hint: { fontSize: 13, fontWeight: '500', marginTop: -4, marginBottom: 10, paddingHorizontal: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth },
  chipLabel: { fontSize: 14, fontWeight: '600' },

  previewCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  previewLabel: { fontSize: 14, fontWeight: '500' },
  previewValue: { fontSize: 15, fontWeight: '600' },

  pressed: { opacity: 0.85 },
});
