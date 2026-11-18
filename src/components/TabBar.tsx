import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Line icons for the bottom bar. One stroke style, drawn on a 24 grid. */
export function TabIcon({ id, color, size = 24 }: { id: string; color: string; size?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {id === 'eggs' ? (
        <Path d="M12 3.2c3.6 0 6.6 5.6 6.6 10.2a6.6 6.6 0 0 1-13.2 0C5.4 8.8 8.4 3.2 12 3.2z" {...p} />
      ) : id === 'chests' ? (
        <>
          <Path d="M4 11h16v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z" {...p} />
          <Path d="M4 11V8.5C4 6 6 4 8.5 4h7C18 4 20 6 20 8.5V11" {...p} />
          <Path d="M10.5 10.5h3v3.5h-3z" {...p} />
        </>
      ) : id === 'dex' ? (
        <>
          <Path d="M12 12.6c-3.1 0-5.6 3.3-5.6 5.5 0 1.7 1.4 2.5 2.9 2.2 1-.2 1.8-.6 2.7-.6s1.7.4 2.7.6c1.5.3 2.9-.5 2.9-2.2 0-2.2-2.5-5.5-5.6-5.5z" {...p} />
          <Ellipse cx={9.2} cy={6.2} rx={1.7} ry={2.2} {...p} />
          <Ellipse cx={14.8} cy={6.2} rx={1.7} ry={2.2} {...p} />
          <Ellipse cx={4.9} cy={10.6} rx={1.6} ry={2} transform="rotate(-25 4.9 10.6)" {...p} />
          <Ellipse cx={19.1} cy={10.6} rx={1.6} ry={2} transform="rotate(25 19.1 10.6)" {...p} />
        </>
      ) : id === 'friends' ? (
        <>
          <Circle cx={9} cy={8} r={3.2} {...p} />
          <Path d="M3.5 19c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2" {...p} />
          <Circle cx={16.5} cy={9} r={2.6} {...p} />
          <Path d="M15.5 13.9c2.6-.2 4.4 1.4 5 4.6" {...p} />
        </>
      ) : (
        <Path d="M4 10.8L12 4l8 6.8V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" {...p} />
      )}
    </Svg>
  );
}

/** The dark, rounded bottom bar with an icon per tab and a number badge for things waiting. */
export default function TabBar<T extends string>({ tabs, active, badges, onPick }: { tabs: { id: T; label: string }[]; active: T; badges: Partial<Record<T, number>>; onPick: (id: T) => void }) {
  // Dock the bar to the very bottom: the dark panel runs down under the home indicator,
  // with the buttons sitting just above it.
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom;
  return (
    // Square, edge to edge (under the side camera column too), so there's no stray gap at the corners.
    <View style={[styles.wrap, { marginBottom: -bottom, paddingBottom: Math.max(bottom - 24, 4), marginLeft: -insets.left, marginRight: -insets.right, paddingLeft: insets.left + 8, paddingRight: insets.right + 8 }]}>
      <View style={styles.bar}>
        {tabs.map((t) => {
          const on = t.id === active;
          const fg = on ? '#FFFFFF' : '#CFE3DA';
          const badge = badges[t.id] ?? 0;
          return (
            <Pressable key={t.id} onPress={() => onPick(t.id)} style={[styles.btn, on && styles.on]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${t.label}, ${badge} waiting` : t.label}>
              <TabIcon id={t.id} color={fg} />
              <Text style={[styles.label, { color: fg }]}>{t.label}</Text>
              {badge > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#24323A', paddingTop: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 2, height: 60, maxWidth: 520, width: '100%', alignSelf: 'center' },
  btn: { width: 64, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2 },
  on: { backgroundColor: '#2FB58A' },
  label: { fontSize: 11, fontWeight: '900' },
  badge: { position: 'absolute', top: 3, right: 7, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#FF6B5B', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
