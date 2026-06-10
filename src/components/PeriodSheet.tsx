/**
 * Shared period selector (ADR-0012) — a kit Sheet to pick Неделя/Месяц/Год/Произвольный,
 * used by BOTH Finance and Analytics. Returns a `Period` (`lib/period`). The screen's ±
 * stepper navigates WITHIN a type; this sheet switches type and picks month/year/range.
 * Web-safe; strings via i18n, colours via theme. Custom range = two sequential date picks.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT, type StringKey } from '@/i18n';
import { customRange, monthOf, weekOf, yearOf, type Period, type PeriodType } from '@/lib/period';
import { useTheme } from '@/theme';
import { Icon, Sheet } from '@/ui';

import { DateTimePickerSheet } from './DateTimePickerSheet';

export interface PeriodSheetProps {
  visible: boolean;
  /** The currently-applied period (anchors which month/year a type-switch lands on). */
  period: Period;
  onClose: () => void;
  onApply: (p: Period) => void;
}

const TYPES: { key: PeriodType; label: StringKey }[] = [
  { key: 'week', label: 'period.week' },
  { key: 'month', label: 'period.month' },
  { key: 'year', label: 'period.year' },
  { key: 'custom', label: 'period.custom' },
];

export function PeriodSheet({ visible, period, onClose, onApply }: PeriodSheetProps) {
  const t = useT();
  const { colors, radius } = useTheme();

  const [type, setType] = useState<PeriodType>(period.type);
  const [year, setYear] = useState(() => new Date(period.start).getFullYear());
  const anchorMonth = new Date(period.start).getMonth();
  const anchorYear = new Date(period.start).getFullYear();

  // Custom range: two sequential date pickers (start → end).
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [pickStart, setPickStart] = useState(false);
  const [pickEnd, setPickEnd] = useState(false);

  const commit = (p: Period) => {
    onApply(p);
    onClose();
  };

  const onPickType = (next: PeriodType) => {
    setType(next);
    if (next === 'week') commit(weekOf(period.start)); // current week of the shown period; stepper navigates
  };

  return (
    <>
      <Sheet title={t('period.title')} visible={visible && !pickStart && !pickEnd} onClose={onClose}>
        <View style={styles.chips}>
          {TYPES.map(({ key, label }) => {
            const on = key === type;
            return (
              <Pressable
                key={key}
                onPress={() => onPickType(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? colors.primary : colors.surface,
                    borderColor: colors.hairline,
                    borderWidth: on ? 0 : StyleSheet.hairlineWidth,
                    borderRadius: radius.pill,
                  },
                ]}>
                <Text style={[styles.chipText, { color: on ? colors.onTint : colors.body }]}>{t(label)}</Text>
              </Pressable>
            );
          })}
        </View>

        {(type === 'month' || type === 'year') && (
          <View>
            <View style={styles.yearBar}>
              <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.prevMonth')} style={[styles.yArrow, { backgroundColor: colors.stoneLight }]}>
                <Icon name="chevronLeft" size={18} sw={1.8} stroke={colors.heading} />
              </Pressable>
              <Text style={[styles.yearLabel, { color: colors.heading }]}>{year}</Text>
              <Pressable onPress={() => setYear((y) => y + 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.nextMonth')} style={[styles.yArrow, { backgroundColor: colors.stoneLight }]}>
                <Icon name="chevronRight" size={18} sw={1.8} stroke={colors.heading} />
              </Pressable>
            </View>

            {type === 'month' ? (
              <View style={styles.grid}>
                {Array.from({ length: 12 }).map((_, m) => {
                  const on = m === anchorMonth && year === anchorYear;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => commit(monthOf(new Date(year, m, 1).getTime()))}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.month, { backgroundColor: on ? colors.primary : colors.stoneLight, borderRadius: radius.field }]}>
                      <Text style={[styles.monthText, { color: on ? colors.onTint : colors.body }]}>
                        {t(`month.${m}` as StringKey).slice(0, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Pressable
                onPress={() => commit(yearOf(new Date(year, 0, 1).getTime()))}
                style={[styles.cta, { backgroundColor: colors.primary, borderRadius: radius.field }]}>
                <Text style={[styles.ctaText, { color: colors.onTint }]}>{`${t('period.selectYear')} ${year}`}</Text>
              </Pressable>
            )}
          </View>
        )}

        {type === 'custom' && (
          <View>
            <Pressable
              onPress={() => {
                setRangeStart(null);
                setPickStart(true);
              }}
              style={[styles.rangeBtn, { borderColor: colors.hairline, borderRadius: radius.field }]}>
              <Icon name="calendar" size={19} sw={1.7} stroke={colors.stoneInactive} />
              <Text style={[styles.rangeText, { color: colors.heading }]}>{t('period.pickDates')}</Text>
              <Icon name="chevronRight" size={18} stroke={colors.stoneInactive} />
            </Pressable>
            <Text style={[styles.hint, { color: colors.muted }]}>{t('period.pickHint')}</Text>
          </View>
        )}
      </Sheet>

      {/* Custom range — start then end (separate sheets so each pick advances cleanly). */}
      <DateTimePickerSheet
        visible={pickStart}
        withTime={false}
        title={t('period.selectStart')}
        initial={period.start}
        onClose={() => setPickStart(false)}
        onPick={(ms) => {
          setRangeStart(ms);
          setPickEnd(true); // advance to the end picker
        }}
      />
      <DateTimePickerSheet
        visible={pickEnd}
        withTime={false}
        title={t('period.pickDates')}
        initial={rangeStart ?? period.start}
        onClose={() => setPickEnd(false)}
        onPick={(ms) => {
          if (rangeStart != null) commit(customRange(rangeStart, ms));
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: '600' },
  yearBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 14 },
  yArrow: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  yearLabel: { fontSize: 17, fontWeight: '600', minWidth: 60, textAlign: 'center', fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  month: { width: '22%', flexGrow: 1, paddingVertical: 12, alignItems: 'center' },
  monthText: { fontSize: 13, fontWeight: '600' },
  cta: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  ctaText: { fontSize: 15, fontWeight: '700' },
  rangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
  rangeText: { flex: 1, fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 8, paddingHorizontal: 2, lineHeight: 18 },
});

export default PeriodSheet;
