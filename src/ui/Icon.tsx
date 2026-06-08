/**
 * Icon — ported from the prototype's hand-drawn 24×24 stroke set
 * (`ICON_PATHS` in t+/components.jsx). Same API: `name`, `size`, `stroke`, `sw`.
 *
 * Stroke props are set on the parent <Svg> and inherited by children
 * (react-native-svg), mirroring the original inline-SVG approach.
 */
import { type ReactNode } from 'react';
import { type ColorValue } from 'react-native';
import { Circle, Path, Rect, Svg } from 'react-native-svg';

export type IconName =
  | 'home' | 'calendar' | 'users' | 'wallet' | 'chart' | 'bell' | 'search'
  | 'filter' | 'sliders' | 'plus' | 'chevronRight' | 'chevronLeft' | 'chevronDown'
  | 'message' | 'share' | 'clock' | 'close' | 'check' | 'video' | 'pin' | 'ruble'
  | 'trash' | 'back' | 'edit' | 'archive' | 'phone' | 'sort' | 'moon' | 'sun'
  | 'grid' | 'sparkle' | 'info' | 'refresh' | 'download' | 'link' | 'eye' | 'eyeOff';

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <Path d="M3.5 10.7 12 3.6l8.5 7.1" />
      <Path d="M5.2 9.6V19.4a1 1 0 0 0 1 1h3.6v-5.6h4.4v5.6h3.6a1 1 0 0 0 1-1V9.6" />
    </>
  ),
  calendar: (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={2.6} />
      <Path d="M3.5 9.4h17" />
      <Path d="M8 3.4v3M16 3.4v3" />
    </>
  ),
  users: (
    <>
      <Circle cx={9.2} cy={8} r={3.1} />
      <Path d="M3.6 20c0-3.2 2.5-5.4 5.6-5.4s5.6 2.2 5.6 5.4" />
      <Path d="M16 5.3a3.1 3.1 0 0 1 0 5.6" />
      <Path d="M17.4 14.9c2 .6 3 2.5 3 5.1" />
    </>
  ),
  wallet: (
    <>
      <Path d="M3.5 8.4A2.4 2.4 0 0 1 5.9 6h11.7a2.4 2.4 0 0 1 2.4 2.4V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" />
      <Path d="M16 12.4h4.5v3.2H16a1.6 1.6 0 0 1 0-3.2z" />
    </>
  ),
  chart: (
    <>
      <Path d="M4 20.4h16" />
      <Path d="M6.5 20.4v-6.2M11 20.4V6.6M15.5 20.4v-9" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 9.5a6 6 0 0 1 12 0c0 4.6 1.8 5.8 1.8 5.8H4.2S6 14.1 6 9.5z" />
      <Path d="M10.2 18.6a1.9 1.9 0 0 0 3.6 0" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={6.4} />
      <Path d="m20 20-3.6-3.6" />
    </>
  ),
  filter: <Path d="M4 5.6h16l-6.2 7.3v6.1l-3.6 1.4v-7.5z" />,
  sliders: (
    <>
      <Path d="M4 8h12" />
      <Circle cx={18} cy={8} r={2} />
      <Path d="M8 16h12" />
      <Circle cx={6} cy={16} r={2} />
    </>
  ),
  plus: <Path d="M12 5.2v13.6M5.2 12h13.6" />,
  chevronRight: <Path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <Path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  chevronDown: <Path d="m5.5 9 6.5 6.5L18.5 9" />,
  message: <Path d="M4 6.6A2.5 2.5 0 0 1 6.5 4.1h11A2.5 2.5 0 0 1 20 6.6v6.8a2.5 2.5 0 0 1-2.5 2.5H9.2L5 19.4V6.6z" />,
  share: (
    <>
      <Path d="M12 14.5V4.2M8.6 7.4 12 4l3.4 3.4" />
      <Path d="M5.2 12.6v5.4a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6v-5.4" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={8.4} />
      <Path d="M12 7.6V12l3 1.8" />
    </>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7" />,
  video: (
    <>
      <Rect x={3.5} y={6.5} width={12} height={11} rx={2.4} />
      <Path d="m15.5 10.4 5-2.6v8.4l-5-2.6z" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s6.2-5.1 6.2-9.6A6.2 6.2 0 0 0 5.8 11.4C5.8 15.9 12 21 12 21z" />
      <Circle cx={12} cy={11.2} r={2.3} />
    </>
  ),
  ruble: (
    <>
      <Path d="M8.5 20V5.6h4.4a4 4 0 0 1 0 8H8.5" />
      <Path d="M6.4 16.4h6.8" />
    </>
  ),
  trash: (
    <>
      <Path d="M4.8 7h14.4" />
      <Path d="M9 7V5.4A1.4 1.4 0 0 1 10.4 4h3.2A1.4 1.4 0 0 1 15 5.4V7" />
      <Path d="M6.6 7l1 11.4a1.6 1.6 0 0 0 1.6 1.5h5.6a1.6 1.6 0 0 0 1.6-1.5L17.4 7" />
    </>
  ),
  back: <Path d="M14.5 5.5 8 12l6.5 6.5" />,
  edit: (
    <>
      <Path d="M14.5 5.6 18.4 9.5" />
      <Path d="M4.5 19.5l.9-3.6L15 5.3a1.5 1.5 0 0 1 2.1 0l1.6 1.6a1.5 1.5 0 0 1 0 2.1L8.1 18.6z" />
    </>
  ),
  archive: (
    <>
      <Rect x={3.6} y={4.6} width={16.8} height={4.4} rx={1.4} />
      <Path d="M5.2 9v8.4a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V9" />
      <Path d="M9.8 12.8h4.4" />
    </>
  ),
  phone: <Path d="M6.2 4.5h3l1.5 3.7-2 1.4a10 10 0 0 0 4.7 4.7l1.4-2 3.7 1.5v3a1.6 1.6 0 0 1-1.7 1.6A14.4 14.4 0 0 1 4.6 6.2 1.6 1.6 0 0 1 6.2 4.5z" />,
  sort: (
    <>
      <Path d="M6 5v14M6 19l-2.4-2.6M6 19l2.4-2.6" />
      <Path d="M13 7h7M13 12h5M13 17h3" />
    </>
  ),
  moon: <Path d="M20 14.4A8.2 8.2 0 0 1 9.6 4 8.2 8.2 0 1 0 20 14.4z" />,
  sun: (
    <>
      <Circle cx={12} cy={12} r={4.2} />
      <Path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
    </>
  ),
  grid: (
    <>
      <Rect x={4} y={4} width={7} height={7} rx={2} />
      <Rect x={13} y={4} width={7} height={7} rx={2} />
      <Rect x={4} y={13} width={7} height={7} rx={2} />
      <Rect x={13} y={13} width={7} height={7} rx={2} />
    </>
  ),
  sparkle: <Path d="M12 3.5l1.8 4.9 4.9 1.8-4.9 1.8L12 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z" />,
  info: (
    <>
      <Circle cx={12} cy={12} r={8.4} />
      <Path d="M12 11v5M12 7.8h.01" />
    </>
  ),
  refresh: (
    <>
      <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <Path d="M17.8 3.4v3.6h-3.6" />
    </>
  ),
  download: (
    <>
      <Path d="M12 4v11M8.4 11.4 12 15l3.6-3.6" />
      <Path d="M5 19.5h14" />
    </>
  ),
  link: (
    <>
      <Path d="M9.5 14.5l5-5" />
      <Path d="M8 12 6.3 13.7a3 3 0 0 0 4.2 4.2L12.2 16" />
      <Path d="M16 12l1.7-1.7a3 3 0 0 0-4.2-4.2L11.8 8" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  eyeOff: (
    <>
      <Path d="M4 4l16 16" />
      <Path d="M9.5 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.5 3.2" />
      <Path d="M6.4 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 3.4-.6" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  /** Stroke colour. Pass a resolved theme colour (e.g. colors.heading). */
  stroke?: ColorValue;
  /** Stroke width. */
  sw?: number;
}

export function Icon({ name, size = 22, stroke = 'currentColor', sw = 1.7 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round">
      {PATHS[name]}
    </Svg>
  );
}

export default Icon;
