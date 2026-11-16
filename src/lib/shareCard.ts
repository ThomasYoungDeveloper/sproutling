import { Image, Platform } from 'react-native';
import { PET_IMAGES } from '../components/petImages';
import { SKIN_IMAGES } from '../components/skinImages';
import { SPECIES_BY_ID } from '../game/species';
import { RARITY_INFO } from '../game/rarity';
import { levelFor } from '../game/scoring';
import { SKIN_INFO } from '../game/skins';
import { ELEMENT_COLOR, ELEMENT_LABEL } from '../game/battle';
import { PERSONALITIES, gradeInfo, gradeOf, personalityOf, statsFor } from '../game/stats';
import type { OwnedPet } from '../game/types';

/**
 * Draws a 1080×1350 pet card (good for Instagram, texts and group chats) and shares or downloads it.
 * Web only for now; the phone app will use its own screenshot sharing.
 */

export const canShareCards = () => Platform.OS === 'web' && typeof document !== 'undefined';

/** On the web a bundled image can be a URL string, an object with a uri, or a module id. */
function assetUri(asset: any): string | undefined {
  if (!asset) return undefined;
  if (typeof asset === 'string') return asset;
  if (typeof asset === 'object') return asset.uri ?? asset.default ?? undefined;
  try {
    return (Image as any).resolveAssetSource?.(asset)?.uri;
  } catch {
    return undefined;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function makeCardBlob(pet: OwnedPet, trainer: string, friendCode: string | null): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const el = ELEMENT_COLOR[sp.element];
  const rarity = RARITY_INFO[sp.rarity];
  const font = (size: number, weight = 900) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  // Background in the pet's element color.
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, el);
  g.addColorStop(1, '#1B2240');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc((i * 137) % W, (i * 251) % H, 6 + (i % 5) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Title.
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(56);
  ctx.textAlign = 'center';
  ctx.fillText('🌱 SPROUTLING', W / 2, 100);

  // Card panel.
  rounded(ctx, 70, 140, W - 140, 1060, 56);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  rounded(ctx, 110, 180, W - 220, 600, 40);
  ctx.fillStyle = '#EEF7FF';
  ctx.fill();
  if (pet.skin || pet.shiny || sp.rarity === 'legendary' || sp.rarity === 'epic') {
    const glow = ctx.createRadialGradient(W / 2, 480, 40, W / 2, 480, 330);
    glow.addColorStop(0, pet.skin ? SKIN_INFO[pet.skin].color : rarity.color);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = glow;
    ctx.fillRect(110, 180, W - 220, 600);
    ctx.globalAlpha = 1;
  }

  // The pet itself.
  const asset = (pet.skin && SKIN_IMAGES[pet.skin]?.[pet.speciesId]) || PET_IMAGES[pet.speciesId];
  const uri = assetUri(asset);
  if (uri) {
    const img = await loadImage(uri);
    ctx.drawImage(img, W / 2 - 270, 210, 540, 540);
  }
  if (pet.shiny) {
    ctx.font = font(64);
    ctx.fillStyle = '#E3A81E';
    ctx.fillText('✦', 860, 260);
  }

  // Badges row.
  const badges: { text: string; color: string }[] = [{ text: rarity.label.toUpperCase(), color: rarity.color }, { text: ELEMENT_LABEL[sp.element].toUpperCase(), color: el }];
  if (pet.skin) badges.push({ text: `${SKIN_INFO[pet.skin].label.toUpperCase()} SKIN`, color: SKIN_INFO[pet.skin].color });
  if (pet.shiny) badges.push({ text: 'SHINY', color: '#E3A81E' });
  const grade = gradeOf(pet);
  badges.push({ text: grade >= 100 ? '💯 PERFECT' : `${grade}%`, color: gradeInfo(grade).color });
  ctx.font = font(30);
  const widths = badges.map((b) => ctx.measureText(b.text).width + 50);
  let bx = W / 2 - (widths.reduce((a, b) => a + b, 0) + (badges.length - 1) * 16) / 2;
  badges.forEach((b, i) => {
    rounded(ctx, bx, 805, widths[i], 56, 28);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(b.text, bx + widths[i] / 2, 844);
    bx += widths[i] + 16;
  });

  // Name and level.
  ctx.fillStyle = '#1F2A2E';
  ctx.font = font(84);
  ctx.textAlign = 'center';
  ctx.fillText(pet.nickname, W / 2, 960);
  ctx.font = font(38, 700);
  ctx.fillStyle = '#5B6B70';
  const pers = PERSONALITIES[personalityOf(pet)];
  ctx.fillText(`Level ${levelFor(pet.xp)} ${sp.name} · ${pers.label}`, W / 2, 1015);

  // Stats.
  const st = statsFor(pet);
  const cells: [string, number][] = [['HP', st.hp], ['ATK', st.atk], ['DEF', st.def], ['SPD', st.spd]];
  const cw = (W - 260) / 4;
  cells.forEach(([label, v], i) => {
    const x = 130 + i * cw;
    rounded(ctx, x + 8, 1055, cw - 16, 110, 24);
    ctx.fillStyle = '#F2F6F4';
    ctx.fill();
    ctx.fillStyle = '#1F2A2E';
    ctx.font = font(46);
    ctx.fillText(String(v), x + cw / 2, 1110);
    ctx.fillStyle = '#5B6B70';
    ctx.font = font(26, 800);
    ctx.fillText(label, x + cw / 2, 1148);
  });

  // Footer invite.
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(36, 800);
  ctx.fillText(`${trainer}’s pet${friendCode ? ` · Friend code ${friendCode}` : ''}`, W / 2, 1262);
  ctx.font = font(30, 700);
  ctx.globalAlpha = 0.85;
  ctx.fillText('Grow your own pet with healthy habits · sproutling.vercel.app', W / 2, 1310);
  ctx.globalAlpha = 1;

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));
}

/** Opens the share sheet with the card, or downloads it if the browser can't share files. */
export async function shareCard(pet: OwnedPet, trainer: string, friendCode: string | null): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  try {
    const blob = await makeCardBlob(pet, trainer, friendCode);
    const file = new File([blob], `${pet.nickname.replace(/[^a-z0-9]+/gi, '-')}-sproutling.png`, { type: 'image/png' });
    const nav: any = navigator;
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'My Sproutling pet', text: `Meet ${pet.nickname}! ${friendCode ? `Add me on Sproutling: ${friendCode}` : ''}` });
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
  } catch (e) {
    console.warn('Share card failed', e);
    return 'failed';
  }
}
