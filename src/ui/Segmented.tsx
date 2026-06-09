import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export interface SegmentedProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  /** Horizontal-scroll mode when there are many tabs. */
  scroll?: boolean;
}

/** iOS-style segmented control (the prototype's `UnderlineTabs`). */
export function Segmented({ tabs, active, onChange, scroll }: SegmentedProps) {
  const { colors } = useTheme();
  const many = scroll ?? tabs.length > 4;

  const items = tabs.map((tab) => {
    const on = tab === active;
    return (
      <Pressable
        key={tab}
        onPress={() => onChange(tab)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={[
          styles.seg,
          many ? styles.segScroll : styles.segFlex,
          { backgroundColor: on ? colors.elev : 'transparent' },
          on ? { boxShadow: '0px 1px 3px rgba(0,0,0,0.12)' } : null,
        ]}>
        <Text style={{ fontSize: 13.5, fontWeight: on ? '600' : '500', color: on ? colors.heading : colors.muted }}>
          {tab}
        </Text>
      </Pressable>
    );
  });

  const track = <View style={[styles.track, { backgroundColor: colors.stoneLight }]}>{items}</View>;

  return (
    <View style={styles.wrap}>
      {many ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {track}
        </ScrollView>
      ) : (
        track
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  track: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 12 },
  seg: { borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segFlex: { flex: 1, paddingVertical: 7, paddingHorizontal: 6 },
  segScroll: { paddingVertical: 7, paddingHorizontal: 14 },
});

export default Segmented;
