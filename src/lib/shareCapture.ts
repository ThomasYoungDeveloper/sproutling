import type { OwnedPet } from '../game/types';
import { shareCard } from './shareCard';

/** Web: draws the full-size card on a canvas and opens the share sheet (or downloads it). */
export async function sharePetCard(_view: unknown, pet: OwnedPet, trainer: string, friendCode: string | null) {
  return shareCard(pet, trainer, friendCode);
}
