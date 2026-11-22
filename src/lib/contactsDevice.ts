/** Web: no contacts access. The iPhone version is contactsDevice.native.ts. */
// Screenshot tests can turn on a demo by setting window.__contactsDemo (players never have it).
const demo = typeof window !== 'undefined' && !!(window as any).__contactsDemo;
export const contactsSupported = demo;
export async function readContactKeys(): Promise<{ contacts: { name: string; phones: string[]; emails: string[] }[] } | { error: string }> {
  if (demo) return { contacts: Array.from({ length: 214 }, (_, i) => ({ name: `C${i}`, phones: [`40755501${String(i).padStart(2, '0')}`], emails: [] })) };
  return { error: 'Finding friends from contacts works in the iPhone app.' };
}
