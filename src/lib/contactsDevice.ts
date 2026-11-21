/** Web: no contacts access. The iPhone version is contactsDevice.native.ts. */
export const contactsSupported = false;
export async function readContactKeys(): Promise<{ contacts: { name: string; phones: string[]; emails: string[] }[] } | { error: string }> {
  return { error: 'Finding friends from contacts works in the iPhone app.' };
}
