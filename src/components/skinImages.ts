import { Platform } from 'react-native';

/**
 * Skin versions of every pet, generated from the original art (scripts/make_skins.py and make_skins2.py).
 * They're served from the website (public/skins) instead of being bundled into the app: there are
 * 1424 of them, more than a live update can carry. Phones cache them after the first load.
 */
const BASE = Platform.OS === 'web' ? '' : 'https://sproutling.vercel.app';
const SKINS = ['ancient', 'crystal', 'ember', 'galaxy', 'gold', 'harvest', 'mono', 'moonlit', 'ocean', 'pastel', 'rainbow', 'retro', 'sakura', 'shadow', 'silver', 'slime'] as const;
const IDS = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19', 'p20', 'p21', 'p22', 'p23', 'p24', 'p25', 'p26', 'p27', 'p28', 'p29', 'p30', 'p31', 'p32', 'p33', 'p34', 'p35', 'p36', 'p37', 'p38', 'p39', 'p40', 'p41', 'p42', 'p43', 'p44', 'p45', 'p46', 'p47', 'p48', 'p49', 'p50', 'p51', 'p52', 'p53', 'p54', 'p55', 'p56', 'p57', 'p58', 'p59', 'p60', 'p61', 'p62', 'p63', 'p64', 'p65', 'p66', 'p67', 'p68', 'p69', 'p70', 'p71', 'p72', 'p73', 'p74', 'p75', 'p76', 'p77', 'p78', 'p79', 'p80', 'p81', 'p82', 'p83', 'p84', 'p85', 'p86', 'p87', 'p88', 'p89'];

export const SKIN_IMAGES: Record<string, Record<string, { uri: string }>> = Object.fromEntries(
  SKINS.map((skin) => [skin, Object.fromEntries(IDS.map((id) => [id, { uri: `${BASE}/skins/${skin}/${id}.png` }]))]),
);
