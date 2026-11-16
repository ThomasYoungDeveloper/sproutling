import { Platform, Share } from 'react-native';
import type { Trainer } from '../state/FriendsContext';

const SITE = 'https://sproutling.vercel.app';

export function inviteLink(code: string): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE;
  return `${origin}/?add=${code}`;
}

/** Opens the share sheet where there is one, otherwise copies the invite. */
export async function shareInvite(code: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = inviteLink(code);
  const text = `Be my friend on Sproutling! My friend code is ${code}.`;
  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title: 'Sproutling', text, url });
        return 'shared';
      } catch {
        return 'cancelled';
      }
    }
    return copyText(`${text} ${url}`);
  }
  try {
    await Share.share({ message: `${text} ${url}` });
    return 'shared';
  } catch {
    return 'failed';
  }
}

export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return 'copied';
    }
  } catch {}
  return 'failed';
}

/** Whether this trainer has played today, judged by when their card last changed. */
export function activeToday(t: Trainer): boolean {
  if (!t.cardUpdatedAt) return false;
  return new Date(t.cardUpdatedAt).toDateString() === new Date().toDateString();
}

export function lastSeen(t: Trainer): string {
  if (!t.cardUpdatedAt) return 'Just getting started';
  if (activeToday(t)) return `${t.card?.todayXp ?? 0} XP today`;
  const days = Math.max(1, Math.round((Date.now() - new Date(t.cardUpdatedAt).getTime()) / 86_400_000));
  return days === 1 ? 'Played yesterday' : `Played ${days} days ago`;
}
