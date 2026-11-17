import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, Text } from 'react-native';
import { reportCrash } from './src/lib/crashReport';

// Report any crash (error text and app build only) so a white screen on a phone can be traced.
const g = globalThis as any;
const previous = g.ErrorUtils?.getGlobalHandler?.();
g.ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
  reportCrash(error, isFatal ? 'fatal' : null);
  previous?.(error, isFatal);
});

/** Shown instead of a white screen if the app can't start. */
function StartupError({ error }: { error: unknown }) {
  const e = error instanceof Error ? error : new Error(String(error));
  return React.createElement(
    ScrollView,
    { contentContainerStyle: { padding: 24, paddingTop: 80, gap: 12 } },
    React.createElement(Text, { style: { fontSize: 22, fontWeight: '900' } }, 'Sproutling couldn’t start'),
    React.createElement(Text, { style: { fontSize: 15 } }, 'Please send this screen to Tom.'),
    React.createElement(Text, { selectable: true, style: { fontSize: 13, color: '#C4562F' } }, e.message),
    React.createElement(Text, { selectable: true, style: { fontSize: 11, color: '#555' } }, (e.stack ?? '').slice(0, 2000)),
  );
}

let Root: React.ComponentType;
try {
  Root = require('./App').default;
} catch (error) {
  reportCrash(error, 'startup');
  Root = () => React.createElement(StartupError, { error });
}

registerRootComponent(Root);
