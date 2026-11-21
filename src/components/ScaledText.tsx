import React from 'react';
import { Text as RNText } from 'react-native';

/**
 * Text follows the phone's text size, up to 1.4×. Past that (the biggest Accessibility sizes) layouts
 * like pop-ups and buttons stop fitting on screen, so the app tops out there. Pop-ups also scroll (FitSheet).
 */
export const MAX_FONT_SCALE = 1.4;

export function Text(props: React.ComponentProps<typeof RNText>) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
