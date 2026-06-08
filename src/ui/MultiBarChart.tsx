import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { chartColors, useTheme } from '@/theme';

export interface BarDatum {
  label: string;
  /** 0..1 bar height fraction. */
  v: number;
  /** Tooltip value (formatted). */
  value?: string;
  /** Highlighted ("on") bar. */
  on?: boolean;
}

export interface MultiBarChartProps {
  data: BarDatum[];
  height?: number;
  compare?: number[];
  showCompare?: boolean;
  onBar?: (bar: BarDatum, index: number) => void;
}

/** Prototype-hardcoded gradient stops / glow for the highlighted ("on") bar. */
const ACCENT_TOP = '#FFE6A6';
const ACCENT_GLOW = '0px 4px 12px -4px rgba(232,180,60,0.6)';

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** Single vertical bar with a top→base gradient fill (SVG, web-safe). */
function BarFill({ top, base }: { top: string; base: string }) {
  // Stable gradient id per colour pair keeps multiple bars independent.
  const gid = `bar-${top}-${base}`.replace(/[^a-zA-Z0-9-]/g, '');
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={base} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={8} ry={8} fill={`url(#${gid})`} />
    </Svg>
  );
}

/**
 * Vertical multi-colour bar chart with tap-to-toggle tooltips and an optional
 * dashed "compare" overlay. Ported from the prototype `t+/kit.jsx` MultiBarChart.
 */
export function MultiBarChart(props: MultiBarChartProps) {
  const { data, height = 150, compare, showCompare, onBar } = props;
  const { colors } = useTheme();
  const [tip, setTip] = useState<number | null>(null);

  return (
    <View style={styles.root}>
      <View style={[styles.row, { height }]}>
        {data.map((b, i) => {
          const base = b.on ? colors.accent : chartColors[i % chartColors.length];
          const top = b.on ? ACCENT_TOP : base;
          const frac = clamp01(b.v);
          const cmp = showCompare && compare ? compare[i] : null;
          const showCmp = cmp != null;
          return (
            <View key={b.label} style={styles.col}>
              <View style={styles.barArea}>
                {showCmp && (
                  <View
                    style={[
                      styles.compare,
                      { height: `${clamp01(cmp) * 100}%`, borderColor: colors.label3 },
                    ]}
                  />
                )}
                <Pressable
                  onPress={() => {
                    setTip(tip === i ? null : i);
                    onBar?.(b, i);
                  }}
                  style={[
                    styles.bar,
                    { height: `${frac * 100}%` },
                    b.on ? { boxShadow: ACCENT_GLOW } : null,
                  ]}
                >
                  <BarFill top={top} base={base} />
                  {tip === i && b.value != null && (
                    <View style={[styles.tip, { backgroundColor: colors.heading }]} pointerEvents="none">
                      <Text style={[styles.tipText, { color: colors.bg }]} numberOfLines={1}>
                        {b.value}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
              <Text
                style={[
                  styles.label,
                  { color: b.on ? colors.heading : colors.muted },
                  b.on ? styles.labelOn : null,
                ]}
              >
                {b.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 8 },
  barArea: {
    position: 'relative',
    width: '100%',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  compare: {
    position: 'absolute',
    bottom: 0,
    left: '18%', // centre a 64%-wide overlay: (100 - 64) / 2
    width: '64%',
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  bar: {
    width: '58%',
    borderRadius: 8,
    position: 'relative',
    overflow: 'visible',
  },
  tip: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 8,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    zIndex: 5,
  },
  tipText: { fontSize: 12, fontWeight: '600' },
  label: { fontSize: 11, fontWeight: '400' },
  labelOn: { fontWeight: '600' },
});

export default MultiBarChart;
