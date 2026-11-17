/** The web version can't receive push notifications; the phone app uses pushTokens.native.ts. */
export async function registerPushToken(_userId: string | null): Promise<void> {}
export async function unregisterPushToken(): Promise<void> {}
export function onPushTap(_open: (tab: string) => void): () => void {
  return () => {};
}
