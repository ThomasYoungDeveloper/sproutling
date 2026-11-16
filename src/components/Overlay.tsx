import React, { createContext, useCallback, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
  return (
    <OverlayCtx.Provider value={{ open, close, setTop }}>
      {children}
      {node ? <View style={[StyleSheet.absoluteFill, { zIndex: 85 }]}>{node}</View> : null}
      {top ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 120 }]}>{top}</View> : null}
    </OverlayCtx.Provider>
  );
}
