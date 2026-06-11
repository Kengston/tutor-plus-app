import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useTheme } from '@/theme';

export interface DonutSegment {
  label: string;
  /** Percentage 0..100. */
  pct: number;
  color: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
}

/**
 * Donut chart — ported from t+/kit.jsx `Donut`. The prototype paints a CSS
 * conic-gradient; under RN each segment is an SVG Circle arc whose
 * strokeDasharray/Offset carve its pct out of the circumference (stroke width =
 * thickness, group rotated -90° to start at the top). The hollow centre
 * (size - 2*thickness) sits on colors.surface and hosts the centre node.
 */
export function Donut(props: DonutProps) {
  const { segments, size = 132, thickness = 22, center } = props;
  const { colors } = useTheme();

  // Stroke is centred on the path, so radius pulls in by half the thickness to
  // keep the outer edge of the ring at `size`.
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  // Lay segments end-to-end: offset each arc back by the accumulated length so it begins where
  // the previous one ended. Precompute the cumulative start-fraction per segment functionally —
  // no in-render reassignment (keeps the render pure; segment count is tiny so O(n²) is fine).
  const fracs = segments.map((seg) => Math.min(Math.max(seg.pct, 0), 100) / 100);
  const starts = fracs.map((_, i) => fracs.slice(0, i).reduce((a, b) => a + b, 0));

  const innerSize = size - 2 * thickness;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* -90° so the first segment starts at 12 o'clock, like conic-gradient. */}
        <G transform={`rotate(-90, ${cx}, ${cy})`}>
          {segments.map((seg, i) => {
            const dash = fracs[i] * circumference;
            const offset = -starts[i] * circumference;
            return (
              <Circle
                key={seg.label}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </G>
      </Svg>

      {/* Hollow centre disc + centre node, mirroring the prototype's inset div. */}
      <View
        style={[
          styles.center,
          {
            top: thickness,
            left: thickness,
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: colors.surface,
          },
        ]}>
        {center}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Donut;
