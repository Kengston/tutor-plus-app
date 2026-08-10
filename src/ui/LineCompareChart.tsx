import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme';
import { Text } from './Text';

export interface LineCompareChartProps {
  /** X-axis labels, one per point (day ranges — data, not UI copy). */
  labels: string[];
  current: number[];
  /** Dashed comparison overlay; omit/null when there is no baseline. */
  compare?: number[] | null;
  height?: number;
  /** Formats a value for the tooltip (money vs count — the screen decides). */
  formatValue: (n: number) => string;
  /** Compact axis-gridline formatter (e.g. «12к»). */
  formatAxis: (n: number) => string;
  /** Legend/tooltip captions — passed in from i18n (this component holds no copy). */
  legendCurrent: string;
  legendCompare?: string;
  diffLabel: string;
}

/** Chart geometry constants (viewBox units; the SVG scales to the container width). */
const W = 300;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 24;

/**
 * Comparative line chart for the Dynamics tab (spec 08 §8.2): a solid accent line for the
 * current period over a dashed neutral line for the comparison period, with tappable points —
 * the selected point shows both values and their difference in a pinned tooltip row above.
 * Pure presentational: all copy arrives via props, all colours via the theme.
 */
export function LineCompareChart(props: LineCompareChartProps) {
  const { labels, current, compare, height = 170, formatValue, formatAxis, legendCurrent, legendCompare, diffLabel } = props;
  const { colors } = useTheme();
  const [sel, setSel] = useState<number | null>(null);

  const H = height;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Y-scale over BOTH series so the dashed overlay never clips; padded above and below
  // (prototype ratios) so lines don't hug the frame. Degenerate (all-equal) spans still render.
  const all = compare ? [...current, ...compare] : current;
  const maxV = Math.max(0, ...all);
  const minV = Math.min(maxV, ...all);
  const span = maxV - minV || maxV || 1;
  const yLo = Math.max(0, minV - span * 0.45);
  const yHi = maxV + span * 0.35;

  const X = (i: number) => PAD_L + (labels.length > 1 ? (innerW * i) / (labels.length - 1) : innerW / 2);
  const Y = (v: number) => PAD_T + innerH * (1 - (v - yLo) / (yHi - yLo));
  const linePath = (arr: readonly number[]) =>
    arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');

  const gridVals = [yHi, (yHi + yLo) / 2, yLo];
  const selDiff = sel != null && compare ? current[sel] - compare[sel] : null;

  return (
    <View>
      {/* Pinned tooltip row — both periods + the difference for the tapped point. */}
      {sel != null ? (
        <View style={[styles.tip, { backgroundColor: colors.stoneLight }]}>
          <Text style={[styles.tipLabel, { color: colors.heading }]}>{labels[sel]}</Text>
          <Text style={[styles.tipItem, { color: colors.body }]}>
            {legendCurrent}: <Text style={styles.tipNum}>{formatValue(current[sel])}</Text>
          </Text>
          {compare && legendCompare ? (
            <Text style={[styles.tipItem, { color: colors.muted }]}>
              {legendCompare}: <Text style={styles.tipNum}>{formatValue(compare[sel])}</Text>
            </Text>
          ) : null}
          {selDiff != null ? (
            <Text style={[styles.tipItem, { color: selDiff >= 0 ? colors.paid : colors.danger }]}>
              {diffLabel}: <Text style={styles.tipNum}>{`${selDiff >= 0 ? '+' : '−'}${formatValue(Math.abs(selDiff))}`}</Text>
            </Text>
          ) : null}
        </View>
      ) : null}

      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Soft horizontal gridlines with compact value labels. */}
        {gridVals.map((gv, gi) => (
          <G key={`g${gi}`}>
            <Line
              x1={PAD_L}
              y1={Y(gv)}
              x2={W - PAD_R}
              y2={Y(gv)}
              stroke={colors.hairline}
              strokeWidth={gi === 2 ? 1 : 0.5}
              strokeDasharray={gi === 2 ? undefined : '2 4'}
            />
            <SvgText x={PAD_L - 6} y={Y(gv) + 3} textAnchor="end" fontSize={8.5} fill={colors.label3}>
              {formatAxis(gv)}
            </SvgText>
          </G>
        ))}

        {/* Comparison period — dashed neutral line + hollow points. */}
        {compare ? (
          <>
            <Path d={linePath(compare)} fill="none" stroke={colors.label3} strokeWidth={1.6} strokeDasharray="4 4" strokeLinecap="round" />
            {compare.map((v, i) => (
              <Circle key={`p${i}`} cx={X(i)} cy={Y(v)} r={2.4} fill={colors.surface} stroke={colors.label3} strokeWidth={1.4} />
            ))}
          </>
        ) : null}

        {/* Current period — solid accent line + tappable points (bigger transparent hit circle). */}
        <Path d={linePath(current)} fill="none" stroke={colors.accent} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        {current.map((v, i) => (
          <G key={`c${i}`}>
            <Circle cx={X(i)} cy={Y(v)} r={13} fill="transparent" onPress={() => setSel(sel === i ? null : i)} />
            <Circle cx={X(i)} cy={Y(v)} r={i === sel ? 5.5 : 3.2} fill={colors.accent} stroke={colors.surface} strokeWidth={2} />
            {i === sel ? (
              <Circle cx={X(i)} cy={Y(v)} r={9} fill="none" stroke={colors.accent} strokeWidth={1.4} strokeOpacity={0.4} />
            ) : null}
          </G>
        ))}

        {/* X labels. */}
        {labels.map((lbl, i) => (
          <SvgText
            key={`x${i}`}
            x={X(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={9}
            fontWeight={i === sel ? '700' : '500'}
            fill={i === sel ? colors.heading : colors.muted}>
            {lbl}
          </SvgText>
        ))}
      </Svg>

      {/* Legend — solid current, dashed comparison. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSolid, { backgroundColor: colors.accent }]} />
          <Text style={[styles.legendText, { color: colors.body }]}>{legendCurrent}</Text>
        </View>
        {compare && legendCompare ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendDashed, { borderColor: colors.label3 }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>{legendCompare}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginBottom: 10,
  },
  tipLabel: { fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tipItem: { fontSize: 12.5 },
  tipNum: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSolid: { width: 16, height: 3, borderRadius: 2 },
  legendDashed: { width: 16, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  legendText: { fontSize: 12, fontWeight: '500' },
});

export default LineCompareChart;
