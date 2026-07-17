/**
 * ScopeSheet (UI-v2 S7, ADR-0016; prototype ScopeSheet) — pick the apply-scope for a
 * series operation: «Только это / Это и следующие / Всю серию». Plain language, no
 * «экземпляр/повторение»; the «all» row is danger-tinted in cancel mode. Presentational
 * — the caller maps the chosen scope to a domain op.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT, type StringKey } from '@/i18n';
import type { Scope } from '@/domain/scope';
import { useTheme } from '@/theme';
import { Card, Icon } from '@/ui';

const SCOPES: Scope[] = ['one', 'following', 'all'];

export function ScopeSheetBody({ mode, onPick }: { mode: 'cancel' | 'edit'; onPick: (scope: Scope) => void }) {
  const t = useT();
  const { colors } = useTheme();

  return (
    <Card style={styles.card}>
      {SCOPES.map((scope, i) => {
        const labelKey = `scope.${mode}.${scope}` as StringKey;
        const subKey = `scope.${mode}.${scope}Sub` as StringKey;
        const danger = mode === 'cancel' && scope === 'all';
        return (
          <View key={scope}>
            {i > 0 ? <View style={[styles.hair, { backgroundColor: colors.hairline }]} /> : null}
            <Pressable
              onPress={() => onPick(scope)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.body}>
                <Text style={[styles.label, { color: danger ? colors.danger : colors.heading }]}>{t(labelKey)}</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>{t(subKey)}</Text>
              </View>
              <Icon name="chevronRight" size={17} stroke={colors.stoneInactive} />
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 2 },
  hair: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  body: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  pressed: { opacity: 0.7 },
});
