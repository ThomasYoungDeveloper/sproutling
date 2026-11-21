import React from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Text } from './ScaledText';
import { reportCrash } from '../lib/crashReport';

/** If a screen crashes, show what happened (and report it) instead of a white screen. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    reportCrash(error, 'render');
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    return (
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '900' }}>Something went wrong</Text>
        <Text style={{ fontSize: 15 }}>Your progress is saved. Tap Try again, and if it keeps happening, send this screen to Tom.</Text>
        <Pressable onPress={() => this.setState({ error: null })} style={{ backgroundColor: '#2EB88A', borderRadius: 14, padding: 14, alignItems: 'center' }} accessibilityRole="button">
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Try again</Text>
        </Pressable>
        <Text selectable style={{ fontSize: 13, color: '#C4562F' }}>{e.message}</Text>
        <Text selectable style={{ fontSize: 11, color: '#555' }}>{(e.stack ?? '').slice(0, 2000)}</Text>
      </ScrollView>
    );
  }
}
