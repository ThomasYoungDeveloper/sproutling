import React, { createContext, useCallback, useContext, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Ctx {
  open: (node: React.ReactNode) => void;
  close: () => void;
  /** A layer above everything, even open sheets (used for celebrations). */
  setTop: (node: React.ReactNode) => void;
}

const OverlayCtx = createContext<Ctx>({ open: () => {}, close: () => {}, setTop: () => {} });
export const useOverlay = () => useContext(OverlayCtx);

/** Shows one full-screen layer (a battle, a pet picker) above the app. */
export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [node, setNode] = useState<React.ReactNode>(null);
  const [top, setTop] = useState<React.ReactNode>(null);
  const open = useCallback((n: React.ReactNode) => setNode(n), []);
  const close = useCallback(() => setNode(null), []);
  // Layers stop at the sides of the app's own area, so nothing runs under a side camera column.
  const insets = useSafeAreaInsets();
  const area = { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0 };
  return (
    <OverlayCtx.Provider value={{ open, close, setTop }}>
      {children}
      {node ? <View style={[area, { zIndex: 85 }]}>{node}</View> : null}
      {top ? <View pointerEvents="box-none" style={[area, { zIndex: 120 }]}>{top}</View> : null}
    </OverlayCtx.Provider>
  );
}
