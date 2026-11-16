import React, { createContext, useCallback, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

interface Ctx {
  open: (node: React.ReactNode) => void;
  close: () => void;
}

const OverlayCtx = createContext<Ctx>({ open: () => {}, close: () => {} });
export const useOverlay = () => useContext(OverlayCtx);

/** Shows one full-screen layer (a battle, a pet picker) above the app. */
export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [node, setNode] = useState<React.ReactNode>(null);
  const open = useCallback((n: React.ReactNode) => setNode(n), []);
  const close = useCallback(() => setNode(null), []);
  return (
    <OverlayCtx.Provider value={{ open, close }}>
      {children}
      {node ? <View style={[StyleSheet.absoluteFill, { zIndex: 85 }]}>{node}</View> : null}
    </OverlayCtx.Provider>
  );
}
