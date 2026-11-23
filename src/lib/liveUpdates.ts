/** Web: the site always loads the newest code, so there's nothing to do. */
export function startLiveUpdates(): () => void {
  return () => {};
}

/** Web: reloading the page loads the newest code. */
export async function updateNow(): Promise<boolean> {
  if (typeof window !== 'undefined') window.location.reload();
  return true;
}
