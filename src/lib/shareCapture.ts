import { toBlob } from 'html-to-image';
import type { OwnedPet } from '../game/types';
import { shareCard } from './shareCard';

/**
 * Web: snapshots the on-screen card (with the pet's hat and aura) at 1080×1350, then opens the
 * share sheet or downloads it. Falls back to the drawn canvas card if the snapshot fails.
 */
export async function sharePetCard(view: unknown, pet: OwnedPet, trainer: string, friendCode: string | null): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  const el = view as HTMLElement | null;
  let blob: Blob | null = null;
  try {
    if (el && typeof el.getBoundingClientRect === 'function') {
      const w = el.getBoundingClientRect().width || 360;
      blob = await toBlob(el, { pixelRatio: 1080 / w, cacheBust: true });
    }
  } catch (e) {
    console.warn('Card snapshot failed, drawing instead', e);
  }
  if (!blob) return shareCard(pet, trainer, friendCode);
  const file = new File([blob], `${pet.nickname.replace(/[^a-z0-9]+/gi, '-')}-sproutling.png`, { type: 'image/png' });
  const nav: any = navigator;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My Sproutling pet', text: `Meet ${pet.nickname}!${friendCode ? ` Add me on Sproutling: ${friendCode}` : ''}` });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
