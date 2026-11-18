import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, Text } from 'react-native';
import { reportCrash } from './src/lib/crashReport';
import { startLiveUpdates } from './src/lib/liveUpdates';

// Report any crash (error text and app build only) so a white screen on a phone can be traced.
const g = globalThis as any;
const previous = g.ErrorUtils?.getGlobalHandler?.();
g.ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
  reportCrash(error, isFatal ? 'fatal' : null);
  // Widgets are a bonus: an error from widget code is reported but never allowed to close the app.
  const stack = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  if (/createWidget|createLiveActivity|expo-widgets|widgetSync/i.test(stack)) return;
  previous?.(error, isFatal);
});

// Live updates start before the game loads, so a fix can still arrive even if the game itself can't start.
try {
  startLiveUpdates();
} catch (e) {
  reportCrash(e, 'live-update');
}

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
