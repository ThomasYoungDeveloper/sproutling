import type { DayLog, Egg, GameState } from './types';

/**
 * Three-way merge of two copies of one player's save (for example the phone and the web app).
 *
 * `base` is the last copy both sides agreed on (the last cloud save this device saw). `mine` and
 * `theirs` each changed since then. Rules, chosen so playing on two devices never loses progress
 * and never duplicates anything:
 * - Coins, items and lifetime counters: start from theirs and add what changed on mine.
 * - Pets, eggs and chests (things with ids): anything added on either side is kept; anything one side
 *   removed (hatched, opened, traded, combined) stays removed. If both changed the same pet, the one
 *   with more XP wins; eggs keep the most steps walked.
 * - Days: each number keeps the higher value; care and rings combine.
 * - "Ever seen" lists (dex, achievements, wardrobe...): combined.
 * - Single choices (active pet, scene, expedition): mine if I changed it, otherwise theirs.
 */
export function mergeSaves(base: GameState | null, mine: GameState, theirs: GameState): GameState {
  if (!base) base = theirs; // No shared history: treat theirs as the starting point and replay mine on top.
  const counter = (b: number | undefined, m: number | undefined, t: number | undefined) =>
    Math.max(0, (t ?? 0) + ((m ?? 0) - (b ?? 0)));
  const pick = <T,>(b: T, m: T, t: T): T => (JSON.stringify(m) !== JSON.stringify(b) ? m : t);
  const union = <T extends Record<string, unknown> | undefined>(...xs: T[]) => Object.assign({}, ...xs.filter(Boolean)) as NonNullable<T>;

  const items: Record<string, number> = {};
  for (const k of new Set([...Object.keys(base.items ?? {}), ...Object.keys(mine.items ?? {}), ...Object.keys(theirs.items ?? {})])) {
    const v = counter(base.items?.[k], mine.items?.[k], theirs.items?.[k]);
    if (v > 0) items[k] = v;
  }

  const foods: Record<string, number> = {};
  for (const k of new Set([...Object.keys(base.foods ?? {}), ...Object.keys(mine.foods ?? {}), ...Object.keys(theirs.foods ?? {})])) {
    const v = counter(base.foods?.[k], mine.foods?.[k], theirs.foods?.[k]);
    if (v > 0) foods[k] = v;
  }

  const stats: NonNullable<GameState['stats']> = {};
  for (const k of ['hatched', 'chests', 'expeditions', 'toys', 'bred'] as const) {
    const v = counter(base.stats?.[k], mine.stats?.[k], theirs.stats?.[k]);
    if (v) stats[k] = v;
  }

  const pets = mergeById(base.pets, mine.pets, theirs.pets, (m, t) => {
    const winner = (m.xp ?? 0) >= (t.xp ?? 0) ? m : t;
    return { ...winner, xp: Math.max(m.xp ?? 0, t.xp ?? 0) };
  });
  const eggs = mergeById(base.eggs, mine.eggs, theirs.eggs, (m, t): Egg => ({
    ...t,
    ...m,
    incubating: m.incubating || t.incubating,
    stepsWalked: Math.max(m.stepsWalked ?? 0, t.stepsWalked ?? 0),
  }));
  const chests = mergeById(base.chests, mine.chests, theirs.chests, (m) => m);

  const days: Record<string, DayLog> = { ...theirs.days };
  for (const [k, d] of Object.entries(mine.days ?? {})) days[k] = days[k] ? mergeDay(d, days[k]) : d;

  const activePetId = pick(base.activePetId, mine.activePetId, theirs.activePetId);
  const merged: GameState = {
    ...theirs,
    coins: counter(base.coins, mine.coins, theirs.coins),
    items,
    foods,
    stats,
    pets,
    eggs,
    chests,
    days,
    incubatorSlots: Math.max(mine.incubatorSlots ?? 1, theirs.incubatorSlots ?? 1),
    dex: union(theirs.dex, mine.dex),
    questChestDays: union(theirs.questChestDays, mine.questChestDays),
    skinDex: union(theirs.skinDex, mine.skinDex),
    achievements: union(theirs.achievements, mine.achievements),
    wardrobe: union(theirs.wardrobe, mine.wardrobe),
    appliedTrades: union(theirs.appliedTrades, mine.appliedTrades),
    events: mergeEvents(theirs.events, mine.events),
    shields: Math.min(2, counter(base.shields, mine.shields, theirs.shields)),
    shieldEarnedOn: maxStr(mine.shieldEarnedOn, theirs.shieldEarnedOn),
    crystalShopDay: maxStr(mine.crystalShopDay, theirs.crystalShopDay),
    login: (mine.login?.count ?? 0) >= (theirs.login?.count ?? 0) ? mine.login : theirs.login,
    walkFinds: newerWalkFinds(mine.walkFinds, theirs.walkFinds),
    battle: newerBattle(mine.battle, theirs.battle),
    tutorialDone: !!(mine.tutorialDone || theirs.tutorialDone) || undefined,
    activePetId: activePetId && pets.some((p) => p.id === activePetId) ? activePetId : pets[0]?.id ?? null,
    scene: pick(base.scene, mine.scene, theirs.scene),
    expedition: pick(base.expedition, mine.expedition, theirs.expedition),
    dayOffset: pick(base.dayOffset, mine.dayOffset, theirs.dayOffset),
  };
  if (merged.expedition && !pets.some((p) => p.id === merged.expedition!.petId)) delete merged.expedition;
  if (merged.tutorialDone === undefined) delete merged.tutorialDone;
  return merged;
}

function mergeById<T extends { id: string }>(base: T[] = [], mine: T[] = [], theirs: T[] = [], both: (m: T, t: T) => T): T[] {
  const inBase = new Set(base.map((x) => x.id));
  const mineById = new Map(mine.map((x) => [x.id, x]));
  const theirsById = new Map(theirs.map((x) => [x.id, x]));
  const out: T[] = [];
  const seen = new Set<string>();
  // Keep theirs' order, then append what only I have.
  for (const t of theirs) {
    const m = mineById.get(t.id);
    if (!m) {
      if (inBase.has(t.id)) continue; // I removed it (hatched, opened, traded...): it stays gone.
      out.push(t); // They added it.
    } else out.push(both(m, t));
    seen.add(t.id);
  }
  for (const m of mine) {
    if (seen.has(m.id)) continue;
    if (inBase.has(m.id) && !theirsById.has(m.id)) continue; // They removed it.
    out.push(m); // I added it.
  }
  return out;
}

function mergeDay(m: DayLog, t: DayLog): DayLog {
  const max = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : Math.max(a ?? 0, b ?? 0));
  const meals = m.meals.length >= t.meals.length ? m.meals : t.meals;
  const out: DayLog = {
    ...t,
    ...m,
    steps: Math.max(m.steps ?? 0, t.steps ?? 0),
    sleepHours: Math.max(m.sleepHours ?? 0, t.sleepHours ?? 0),
    water: Math.max(m.water ?? 0, t.water ?? 0),
    workoutMinutes: Math.max(m.workoutMinutes ?? 0, t.workoutMinutes ?? 0),
    meals,
  };
  const hs = max(m.healthSteps, t.healthSteps);
  if (hs !== undefined) out.healthSteps = hs;
  const ex = max(m.exerciseMin, t.exerciseMin);
  if (ex !== undefined) out.exerciseMin = ex;
  const mi = max(m.mindfulMin, t.mindfulMin);
  if (mi !== undefined) out.mindfulMin = mi;
  if (m.shielded || t.shielded) out.shielded = true;
  if (m.care || t.care) {
    const later = (m.care?.foodAt ?? 0) >= (t.care?.foodAt ?? 0) ? m.care : t.care;
    const laterFun = (m.care?.funAt ?? 0) >= (t.care?.funAt ?? 0) ? m.care : t.care;
    out.care = {
      fed: !!(m.care?.fed || t.care?.fed) || undefined,
      treat: !!(m.care?.treat || t.care?.treat) || undefined,
      played: max(m.care?.played, t.care?.played),
      food: later?.food,
      foodAt: later?.foodAt,
      fun: laterFun?.fun,
      funAt: laterFun?.funAt,
      boosts: max(m.care?.boosts, t.care?.boosts),
    };
    for (const k of Object.keys(out.care) as (keyof typeof out.care)[]) if (out.care[k] === undefined) delete out.care[k];
  }
  if (m.rings || t.rings) {
    out.rings = {
      move: Math.max(m.rings?.move ?? 0, t.rings?.move ?? 0),
      exercise: Math.max(m.rings?.exercise ?? 0, t.rings?.exercise ?? 0),
      stand: Math.max(m.rings?.stand ?? 0, t.rings?.stand ?? 0),
    };
  }
  return out;
}

function mergeEvents(a?: Record<string, number[]>, b?: Record<string, number[]>) {
  if (!a && !b) return undefined;
  const out: Record<string, number[]> = {};
  for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) out[k] = [...new Set([...(a?.[k] ?? []), ...(b?.[k] ?? [])])].sort((x, y) => x - y);
  return out;
}

const maxStr = (a?: string, b?: string) => (!a ? b : !b ? a : a > b ? a : b);

function newerWalkFinds(m: GameState['walkFinds'], t: GameState['walkFinds']) {
  if (!m) return t;
  if (!t) return m;
  if (m.day !== t.day) return m.day > t.day ? m : t;
  return { day: m.day, checked: Math.max(m.checked, t.checked), found: Math.max(m.found, t.found), foraged: Math.max(m.foraged ?? 0, t.foraged ?? 0) };
}

function newerBattle(m: GameState['battle'], t: GameState['battle']) {
  if (!m) return t;
  if (!t) return m;
  const base = m.day >= t.day ? m : t;
  return {
    ...base,
    rewarded: m.day === t.day ? Math.max(m.rewarded, t.rewarded) : base.rewarded,
    wonToday: m.day === t.day ? m.wonToday || t.wonToday : base.wonToday,
    wins: Math.max(m.wins, t.wins),
    losses: Math.max(m.losses, t.losses),
  };
}

/** True when two saves hold the same data (cheap enough for our save sizes). */
export const sameSave = (a: GameState, b: GameState) => JSON.stringify(a) === JSON.stringify(b);
