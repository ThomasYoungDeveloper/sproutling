import { requireOptionalNativeModule } from 'expo';
import { logEvent } from './gameLog';

/**
 * Contacts need the native module from the next iPhone build. On older builds (which get this code by an
 * over-the-air update) the module isn't there, so the feature stays hidden instead of crashing.
 */
export const contactsSupported = !!requireOptionalNativeModule('ExpoContacts');

/** Reads names, phone numbers and emails from the phone's contacts (asks permission the first time). */
export async function readContactKeys(): Promise<{ contacts: { name: string; phones: string[]; emails: string[] }[] } | { error: string }> {
  if (!contactsSupported) return { error: 'Update Sproutling to find friends from your contacts.' };
  try {
    // The older contacts API lives under /legacy in this Expo version; the main import throws on purpose.
    const Contacts = require('expo-contacts/legacy') as typeof import('expo-contacts/legacy');
    const perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== 'granted') return { error: 'Contacts are off for Sproutling. You can turn them on in iPhone Settings › Sproutling.' };
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Name] });
    return {
      contacts: data.map((c) => ({
        name: c.name ?? '',
        phones: (c.phoneNumbers ?? []).map((p) => p.number ?? p.digits ?? '').filter(Boolean),
        emails: (c.emails ?? []).map((e) => e.email ?? '').filter(Boolean),
      })),
    };
  } catch (e) {
    logEvent('contacts_error', { message: String((e as Error)?.message ?? e).slice(0, 300) });
    return { error: 'Couldn’t read your contacts. Try again in a moment.' };
  }
}
