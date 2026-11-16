import type { Rarity, Species } from './types';

/** Launch roster: 24 species across five rarities. New species ship each season. */
export const SPECIES: Species[] = [
  // Common (8)
  { id: 'mochi', name: 'Mochi', rarity: 'common', element: 'flower', body: 'blob', ears: 'none', topper: 'sprout', colors: { body: '#7FD8B5', belly: '#C9F0DF', accent: '#7CCB5B' }, blurb: 'A squishy friend who loves morning walks.' },
  { id: 'puffcat', name: 'Puffcat', rarity: 'common', element: 'ember', body: 'round', ears: 'cat', topper: 'none', colors: { body: '#FFB27A', belly: '#FFE0C7', accent: '#FF8A4C' }, blurb: 'Naps in sunbeams after a good workout.' },
  { id: 'bunbun', name: 'Bunbun', rarity: 'common', element: 'flower', body: 'tall', ears: 'bunny', topper: 'none', colors: { body: '#F7C6D9', belly: '#FDE8F0', accent: '#F59AB9' }, blurb: 'Hops a little higher with every glass of water.' },
  { id: 'drip', name: 'Drip', rarity: 'common', element: 'tide', body: 'blob', ears: 'none', topper: 'drop', colors: { body: '#8FD0F0', belly: '#D6EEFA', accent: '#5BB8EA' }, blurb: 'Made of 100% hydration.' },
  { id: 'tofu', name: 'Tofu', rarity: 'common', element: 'moon', body: 'wide', ears: 'bear', topper: 'none', colors: { body: '#F2EDE4', belly: '#FFFFFF', accent: '#CFC5B4' }, blurb: 'Soft, sleepy and proud of an early bedtime.' },
  { id: 'sparky', name: 'Sparky', rarity: 'common', element: 'ember', body: 'round', ears: 'antenna', topper: 'none', colors: { body: '#FFE07A', belly: '#FFF3C4', accent: '#F2B705' }, blurb: 'Buzzes with energy after a run.' },
  { id: 'minnow', name: 'Minnow', rarity: 'common', element: 'tide', body: 'round', ears: 'fins', topper: 'none', colors: { body: '#9EDDE0', belly: '#DFF6F6', accent: '#4FB7BD' }, blurb: 'Small swimmer, big stamina.' },
  { id: 'acorn', name: 'Acorn', rarity: 'common', element: 'flower', body: 'round', ears: 'bear', topper: 'sprout', colors: { body: '#C9A27E', belly: '#EBD9C6', accent: '#7CCB5B' }, blurb: 'Grows a little every day, just like you.' },
  // Uncommon (6)
  { id: 'foxie', name: 'Foxie', rarity: 'uncommon', element: 'ember', body: 'tall', ears: 'fox', topper: 'none', colors: { body: '#FF9A5C', belly: '#FFE6D3', accent: '#E8743A' }, blurb: 'Quick on its feet and quicker to cheer you on.' },
  { id: 'moonbun', name: 'Moonbun', rarity: 'uncommon', element: 'moon', body: 'tall', ears: 'bunny', topper: 'moon', colors: { body: '#B9AAF2', belly: '#E6E0FB', accent: '#FFE27A' }, blurb: 'Only comes out after eight hours of sleep.' },
  { id: 'shellby', name: 'Shellby', rarity: 'uncommon', element: 'tide', body: 'wide', ears: 'none', topper: 'crystal', colors: { body: '#7EC8C0', belly: '#D2EFEB', accent: '#B8E6FF' }, blurb: 'Slow and steady wins the streak.' },
  { id: 'shroomy', name: 'Shroomy', rarity: 'uncommon', element: 'flower', body: 'blob', ears: 'none', topper: 'mushroom', colors: { body: '#F4E3C8', belly: '#FFF6E8', accent: '#E8604C' }, blurb: 'Thrives on veggies and good vibes.' },
  { id: 'owlet', name: 'Owlet', rarity: 'uncommon', element: 'moon', body: 'round', ears: 'tufts', topper: 'none', colors: { body: '#A99C8C', belly: '#E9E1D6', accent: '#7A6C5C' }, blurb: 'Wise enough to never skip rest days.' },
  { id: 'coral', name: 'Coral', rarity: 'uncommon', element: 'tide', body: 'blob', ears: 'fins', topper: 'flower', colors: { body: '#FF9E9E', belly: '#FFE0E0', accent: '#FF6F8A' }, blurb: 'Blooms brighter when you hit your water goal.' },
  // Rare (5)
  { id: 'cinderpup', name: 'Cinder Pup', rarity: 'rare', element: 'ember', body: 'round', ears: 'bear', topper: 'flame', colors: { body: '#E8735A', belly: '#FFD3C4', accent: '#FF8A4C' }, blurb: 'Its little flame grows with your streak.' },
  { id: 'lumijelly', name: 'Lumi Jelly', rarity: 'rare', element: 'tide', body: 'tall', ears: 'antenna', topper: 'drop', colors: { body: '#C7B8FF', belly: '#EEE9FF', accent: '#7FE0F0' }, blurb: 'Glows softly on nights you sleep well.' },
  { id: 'starkit', name: 'Starkit', rarity: 'rare', element: 'moon', body: 'round', ears: 'cat', topper: 'star', colors: { body: '#5F6FB8', belly: '#C9D0F2', accent: '#FFE27A' }, blurb: 'Fell from the sky during a midnight walk.' },
  { id: 'bloomfawn', name: 'Bloomfawn', rarity: 'rare', element: 'flower', body: 'tall', ears: 'horns', topper: 'flower', colors: { body: '#D9B48C', belly: '#F6E9D9', accent: '#FFB7C9' }, blurb: 'Flowers sprout wherever it wanders.' },
  { id: 'frostfin', name: 'Frostfin', rarity: 'rare', element: 'tide', body: 'wide', ears: 'fins', topper: 'crystal', colors: { body: '#BFE6FA', belly: '#F0FAFF', accent: '#8FD0F0' }, blurb: 'Cool, calm and impossible to rattle.' },
  // Epic (3)
  { id: 'nebulacat', name: 'Nebula Cat', rarity: 'epic', element: 'moon', body: 'round', ears: 'cat', topper: 'star', colors: { body: '#3D3A7A', belly: '#8E7CE0', accent: '#FFB7F0' }, blurb: 'Carries a tiny galaxy in its fur.' },
  { id: 'phoenixchick', name: 'Phoenix Chick', rarity: 'epic', element: 'ember', body: 'round', ears: 'tufts', topper: 'flame', colors: { body: '#FF7A45', belly: '#FFD25E', accent: '#FF4F3A' }, blurb: 'Rises again after every missed day.' },
  { id: 'willowsprite', name: 'Willow Sprite', rarity: 'epic', element: 'flower', body: 'tall', ears: 'antenna', topper: 'sprout', colors: { body: '#A8E6A1', belly: '#E4F8E0', accent: '#5DBB63' }, blurb: 'A forest spirit that rewards consistency.' },
  // Legendary (2)
  { id: 'celestialdragon', name: 'Celestial Dragon', rarity: 'legendary', element: 'moon', body: 'wide', ears: 'horns', topper: 'star', colors: { body: '#2C3E8C', belly: '#9FB4FF', accent: '#FFD84D' }, blurb: 'Said to appear only to the truly dedicated.' },
  { id: 'tidaldrake', name: 'Tidal Drake', rarity: 'legendary', element: 'tide', body: 'wide', ears: 'fins', topper: 'crystal', colors: { body: '#1F8FA8', belly: '#9EE6F0', accent: '#E6FBFF' }, blurb: 'Guardian of the deep, born from 20 km of steps.' },
];

export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export function speciesOfRarity(r: Rarity): Species[] {
  return SPECIES.filter((s) => s.rarity === r);
}
