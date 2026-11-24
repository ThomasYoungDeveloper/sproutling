import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { Icon, type IconName } from './Icon';
import { colors, space, TAP } from '../theme';

/** iOS-style settings building blocks: a labeled group of rows on a white card, rows split by thin lines. */
export function Group({ label, note, children }: { label?: string; note?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.card}>
        {rows.map((r, i) => (
          <View key={i} style={i > 0 && styles.divider}>{r}</View>
        ))}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

export function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.switch, on && styles.switchOn]}>
      <View style={[styles.knob, on && { alignSelf: 'flex-end' }]} />
    </View>
  );
}

export function SRow({
  icon,
  tint = colors.mintSoft,
  iconColor = colors.mintDark,
  title,
  sub,
  right,
  value,
  onPress,
  chevron,
  danger,
  switchOn,
  a11y,
}: {
  icon?: IconName;
  tint?: string;
  iconColor?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  switchOn?: boolean;
  a11y?: string;
}) {
  const isSwitch = switchOn !== undefined;
  const body = (
    <>
      {icon ? (
        <View style={[styles.iconTile, { backgroundColor: tint }]}>
          <Icon name={icon} size={17} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={[styles.title, danger && { color: '#C2412D' }]} numberOfLines={2}>{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {right}
      {isSwitch ? <Switch on={!!switchOn} /> : null}
      {chevron ? <Icon name="chevron" size={16} color="#A9B5B0" /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F5F8F7' }]}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityState={isSwitch ? { checked: !!switchOn } : undefined}
      accessibilityLabel={a11y ?? title}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: space.lg },
  note: { fontSize: 12, fontWeight: '500', color: colors.muted, paddingHorizontal: space.lg },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.line, marginLeft: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TAP + 4, paddingVertical: 10, paddingHorizontal: space.lg },
  iconTile: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 12, fontWeight: '500', color: colors.muted },
  value: { fontSize: 15, fontWeight: '500', color: colors.muted, maxWidth: '45%' },
  switch: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#D6DEDA', padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.mint },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
});
