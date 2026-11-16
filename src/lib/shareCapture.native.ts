import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { OwnedPet } from '../game/types';

/** Phone app: snapshots the on-screen card at 1080×1350 and opens the iPhone share sheet. */
export async function sharePetCard(view: any, pet: OwnedPet, _trainer: string, friendCode: string | null): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  if (!view) return 'failed';
  try {
    const uri = await captureRef(view, { format: 'png', width: 1080, height: 1350, result: 'tmpfile' });
    const r = await Share.share({
      url: uri.startsWith('file://') ? uri : `file://${uri}`,
      message: `Meet ${pet.nickname}!${friendCode ? ` Add me on Sproutling: ${friendCode}` : ''}`,
    });
    return r.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch (e) {
    console.warn('Share card failed', e);
    return 'failed';
  }
}
