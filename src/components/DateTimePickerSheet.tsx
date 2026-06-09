/**
 * Shared date(+time) picker — a kit Sheet hosting a Mon-first month grid and an hh:mm
 * row. Web-safe by construction (no native @react-native-community/datetimepicker; ADR-0007
 * web-first), reused by the lesson create form (pick date) and the lesson card (reschedule).
 * Returns a UTC-instant ms (ADR-0005). All strings via i18n; colours via theme.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import type { StringKey } from '@/i18n';
import { nowMs } from '@/lib/time';
import { useTheme } from '@/theme';
import { Icon, Sheet } from '@/ui';

export interface DateTimePickerSheetProps {
  visible: boolean;
  /** Initial instant (UTC ms). Defaults to now. */
  initial?: number;
  /** Show the hh:mm time row (default true). */
  withTime?: boolean;
  title?: string;
  onClose: () => void;
  /** Chosen UTC-ms instant on confirm. */
  onPick: (ms: number) => void;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** Mon-first weekday index (0=Mon … 6=Sun) from JS getDay() (0=Sun). */
const monIndex = (jsDay: number) => (jsDay + 6) % 7;
const clampInt = (s: string, max: number) => {
  const n = parseInt(s.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : Math.min(Math.max(n, 0), max);
};
const pad2 = (n: number) => String(n).padStart(2, '0');

const WD: StringKey[] = ['wd.1', 'wd.2', 'wd.3', 'wd.4', 'wd.5', 'wd.6', 'wd.0'];

export function DateTimePickerSheet({
  visible,
  initial,
  withTime = true,
  title,
  onClose,
  onPick,
}: DateTimePickerSheetProps) {
  const t = useT();
  const { colors } = useTheme();

  const base = initial ?? nowMs();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date(base)));
  const [selected, setSelected] = useState<number>(() => startOfDay(base));
  const [hh, setHh] = useState<string>(() => pad2(new Date(base).getHours()));
  const [mm, setMm] = useState<string>(() => pad2(new Date(base).getMinutes()));

  const cells = useMemo(() => {
    const lead = monIndex(startOfMonth(month).getDay());
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < lead; i += 1) out.push(null);
    for (let d = 1; d <= days; d += 1) out.push(new Date(month.getFullYear(), month.getMonth(), d).getTime());
    return out;
  }, [month]);

  const today = startOfDay(nowMs());
  const goMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const confirm = () => {
    const ms = selected + (withTime ? clampInt(hh, 23) * 3_600_000 + clampInt(mm, 59) * 60_000 : 0);
    onPick(ms);
    onClose();
  };

  return (
    <Sheet title={title} visible={visible} onClose={onClose}>
      <View style={styles.monthBar}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={8} style={[styles.arrow, { backgroundColor: colors.stoneLight }]}>
          <Icon name="chevronLeft" size={18} sw={1.8} stroke={colors.heading} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: colors.heading }]}>
          {t(`month.${month.getMonth()}` as StringKey)} {month.getFullYear()}
        </Text>
        <Pressable onPress={() => goMonth(1)} hitSlop={8} style={[styles.arrow, { backgroundColor: colors.stoneLight }]}>
          <Icon name="chevronRight" size={18} sw={1.8} stroke={colors.heading} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WD.map((k, i) => (
          <Text key={k} style={[styles.weekday, { color: i >= 5 ? colors.label3 : colors.muted }]}>
            {t(k)}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (cell == null) return <View key={`b${i}`} style={styles.cell} />;
          const isSel = cell === selected;
          const isToday = cell === today;
          return (
            <Pressable key={cell} onPress={() => setSelected(cell)} style={styles.cell}>
              <View style={[styles.dayWrap, isSel && { backgroundColor: colors.primary }]}>
                <Text
                  style={[
                    styles.dayNum,
                    { color: isSel ? colors.onTint : isToday ? colors.primary : colors.heading },
                  ]}>
                  {new Date(cell).getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {withTime && (
        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: colors.muted }]}>{t('field.time')}</Text>
          <View style={styles.timeInputs}>
            <TextInput
              value={hh}
              onChangeText={setHh}
              onBlur={() => setHh(pad2(clampInt(hh, 23)))}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.timeInput, { backgroundColor: colors.surface, color: colors.heading, borderColor: colors.hairline }]}
            />
            <Text style={[styles.colon, { color: colors.heading }]}>:</Text>
            <TextInput
              value={mm}
              onChangeText={setMm}
              onBlur={() => setMm(pad2(clampInt(mm, 59)))}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.timeInput, { backgroundColor: colors.surface, color: colors.heading, borderColor: colors.hairline }]}
            />
          </View>
        </View>
      )}

      <Pressable onPress={confirm} style={[styles.confirm, { backgroundColor: colors.primary }]}>
        <Text style={[styles.confirmLabel, { color: colors.onTint }]}>{t('common.done')}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  arrow: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16.5, fontWeight: '600', letterSpacing: -0.2 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 14.5, fontWeight: '500' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  timeLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    width: 64,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  colon: { fontSize: 20, fontWeight: '700' },
  confirm: { marginTop: 18, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  confirmLabel: { fontSize: 15.5, fontWeight: '700' },
});
