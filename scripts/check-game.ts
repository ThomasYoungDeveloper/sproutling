import { newGame } from '../src/game/seed';
import * as A from '../src/game/actions';
import { CHESTS, oddsFor } from '../src/game/loot';
import { SPECIES, speciesOfRarity } from '../src/game/species';
import { RARITIES, stepsToHatch } from '../src/game/rarity';
import { buildCard, readCard } from '../src/game/card';
import * as C from '../src/game/care';
import * as T from '../src/game/trade';
import * as B from '../src/game/battle';
import * as Cos from '../src/game/cosmetics';
import * as Team from '../src/game/team';
import * as Ex from '../src/game/expedition';
import * as Ach from '../src/game/achievements';
import * as Sk from '../src/game/skins';
import * as Br from '../src/game/breeding';
import * as St from '../src/game/stats';
import { levelFor, levelProgress, stageFor, scoreDay } from '../src/game/scoring';
import type { ChestKind, GameState } from '../src/game/types';
import { mergeSaves } from '../src/game/merge';
import * as Pw from '../src/game/powerups';
import * as Hp from '../src/game/hp';
import * as Wd from '../src/game/wild';
import * as Tw from '../src/game/tower';
import * as In from '../src/game/intro';
import * as Un from '../src/game/unlocks';
import { dailyQuests } from '../src/game/scoring';
const F_count = (s: any, id: string) => s.foods?.[id] ?? 0;

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(Object.keys(CHESTS) as ChestKind[]).forEach((k) => {
  const sum = Object.values(CHESTS[k].eggRarity).reduce((a, b) => a + b, 0);
  ok(sum === 100, `${k} rarity weights sum to 100 (${sum})`);
  const o = oddsFor(k); ok(Math.abs(Object.values(o).reduce((a, b) => a + b, 0) - CHESTS[k].eggChance) < 0.5, `${k} odds add up to egg chance`);
});
RARITIES.forEach((r) => ok(speciesOfRarity(r).length > 0, `${r} has species (${speciesOfRarity(r).length})`));
ok(new Set(SPECIES.map((s) => s.id)).size === SPECIES.length, 'species ids unique');

let s0 = newGame();
ok(A.needsStarter(s0), 'new players must pick a starter egg');
const st = A.chooseStarter(s0, () => 0.3);
ok(st.state.pets.length === 1 && SPECIES.find((x) => x.id === st.pet.speciesId)!.rarity === 'common', 'starter is a Common');
const starterEls = new Set(Array.from({ length: 800 }, () => A.chooseStarter(s0).pet.speciesId).map((id) => SPECIES.find((x) => x.id === id)!.element));
ok(starterEls.size === 9, 'the one starter egg can hatch every type');
ok(st.state.chests.length === 1, 'starter comes with a welcome chest');
let s = st.state; s = { ...s, eggs: [{ id: 'egg1', rarity: 'common', stepsWalked: 2100, incubating: true, foundOn: '' }, { id: 'egg2', rarity: 'rare', stepsWalked: 0, incubating: false, foundOn: '' }], days: { [A.todayKey(s)]: { steps: 4200, sleepHours: 7.5, water: 3, workoutMinutes: 0, meals: [{ name: 'Oats', calories: 320, veggies: true }] } } };
const xp0 = A.activePet(s)!.xp, coins0 = s.coins;
s = A.addSteps(s, 1000);
ok(A.activePet(s)!.xp === xp0 + 10, 'steps give XP to active pet');
ok(s.coins > coins0 - 1, 'coins never drop when earning');
const egg = s.eggs.find((e) => e.incubating)!;
ok(egg.stepsWalked === 2100 + 1000, 'steps warm incubating egg');
ok(s.eggs.find((e) => !e.incubating)!.stepsWalked === 0, 'idle egg not warmed');
s = A.addSteps(s, stepsToHatch('common'));
ok(A.isReady(s.eggs.find((e) => e.id === egg.id)!), 'egg ready after enough steps');
const h = A.hatch(s, egg.id, () => 0.5)!;
ok(!!h && h.state.pets.length === 2 && h.state.eggs.length === 1, 'hatch adds pet and removes egg');
ok(speciesOfRarity('common').some((x) => x.id === h.pet.speciesId), 'hatched species matches egg rarity');
s = h.state;
const chestsBefore = s.chests.length;
s = A.addSteps(s, 8000 - A.today(s).steps); s = A.setWater(s, 8); s = A.addMeal(s, { name: 'a', calories: null, veggies: false }); s = A.addMeal(s, { name: 'b', calories: null, veggies: true });
ok(s.chests.length === chestsBefore + 1, 'bronze chest granted when all quests done');
s = A.addSteps(s, 500);
ok(s.chests.length === chestsBefore + 1, 'bronze chest only once per day');
const c = s.chests[0]; const r = A.openChestById(s, c.id, () => 0.01)!;
ok(r.state.chests.length === s.chests.length - 1 && r.result.coins >= CHESTS[c.kind].coins[0], 'opening chest pays coins and removes it');
const before = A.activePet(s)!.xp; s = A.setWater(s, 7);
ok(A.activePet(s)!.xp === before - 4 - 15, 'undoing a habit removes its XP (and the quest bonus)');
s = A.incubate(A.incubate(s, s.eggs[0].id), 'nope');
ok(A.incubatingCount(s) <= s.incubatorSlots, 'incubator slots respected');
let t = A.setWater(s, 3); const c0 = t.coins; for (let i = 0; i < 20; i++) { t = A.setWater(t, 4); t = A.setWater(t, 3); }
ok(t.coins === c0, 'toggling a habit up and down cannot farm coins');
// Friends
const card = buildCard(t);
ok(card.v === 1 && card.team.length === Math.min(t.pets.length, 6) && card.team[0].speciesId === A.activePet(t)!.speciesId, 'trainer card leads with the active pet');
ok(!('meals' in card) && !JSON.stringify(card).includes('sleep'), 'trainer card shares no health details');
ok(JSON.stringify(card).length < 8000, 'trainer card fits the database size limit');
ok(readCard({}) === null && readCard(card) !== null, 'old or empty cards are ignored safely');
const g0 = A.openGifts(t, 3, () => 0.5);
ok(g0.coins === 30 && g0.chests === 0 && g0.state.coins === t.coins + 30, 'each gift pays 10 coins');
const g1 = A.openGifts(t, 2, () => 0.05);
ok(g1.chests === 2 && g1.state.chests.length === t.chests.length + 2, 'gifts can hide a surprise Bronze chest');
ok(A.openGifts(t, 0).state.coins === t.coins, 'no gifts, no coins');
// Daily login
let L: GameState = { ...t, login: undefined };
ok(A.loginStatus(L).canClaim && A.loginStatus(L).index === 0, 'new players can claim day 1');
const l1 = A.claimLogin(L)!; ok(l1.day === 1 && l1.state.coins === L.coins + 25, 'day 1 pays 25 coins');
ok(A.claimLogin(l1.state) === null, 'only one login reward per day');
L = l1.state; for (let i = 0; i < 5; i++) L = A.claimLogin(A.nextDay(L))!.state;
const l7 = A.claimLogin(A.nextDay(L))!; ok(l7.day === 7 && l7.state.chests.some((c) => c.kind === 'silver'), 'day 7 gives a Silver chest');
const l8 = A.claimLogin(A.nextDay(A.nextDay(l7.state)))!; ok(l8.day === 1, 'calendar loops, and a missed day doesn’t punish you');
// Levels
ok(levelFor(0) === 1 && levelFor(49) === 1 && levelFor(50) === 2 && levelFor(300) === 4 && levelFor(1050) === 7, 'level thresholds');
ok(stageFor(299) === 'baby' && stageFor(300) === 'teen' && stageFor(1050) === 'adult', 'teen at Lv4, adult at Lv7');
const lp = levelProgress(200); ok(lp.level === 3 && lp.into === 50 && lp.need === 150, 'level progress bar math');
// Care
let K = { ...t, days: {}, items: { 'Moon Seed': 2 } } as GameState;
K = A.addSteps(K, 5000);
const base = A.activePet(K)!.xp;
ok(C.moodFor(A.today(K)) === 'hungry', 'unfed pet is hungry (no penalty)');
K = C.feed(K);
ok(A.activePet(K)!.xp > base, 'feeding boosts XP already earned today');
ok(Math.abs(C.careMultiplier(A.today(K)) - 1.1) < 1e-9, 'feeding gives 1.1x');
K = C.play(C.play(K)); ok(!C.careTasks(A.today(K))[1].done, 'two plays is not enough');
K = C.play(K); ok(C.careTasks(A.today(K))[1].done, 'three plays completes play');
K = C.treat(K); ok(K.items['Moon Seed'] === 1 && Math.abs(C.careMultiplier(A.today(K)) - 1.3) < 1e-9, 'treat uses a trinket, 1.3x max');
ok(C.treat(K) === K, 'only one treat per day');
const noBag = { ...t, days: {}, items: {} } as GameState; ok(C.treat(noBag) === noBag, 'no trinkets, no treat');
const K2 = A.nextDay(K); ok(C.careMultiplier(A.today(K2)) === 1 && A.activePet(K2)!.xp === A.activePet(K)!.xp, 'next day care resets but XP is kept');
ok(C.reminders(noBag).some((r) => r.id === 'feed') && !C.reminders(K).some((r) => r.id === 'feed'), 'reminders follow care');
// Trading
let TR = { ...t, pets: [...t.pets, { id: 'extra1', speciesId: 'p02', nickname: 'Extra', xp: 60, shiny: false, hatchedOn: '' }] } as GameState;
const notActive = TR.pets.find((p) => p.id !== TR.activePetId)!;
ok(!T.canOffer(TR, TR.activePetId!, new Set()).ok, 'active pet cannot be traded');
ok(T.canOffer(TR, notActive.id, new Set()).ok && !T.canOffer(TR, notActive.id, new Set([notActive.id])).ok, 'pet in another trade cannot be offered');
ok(!T.canOffer({ ...TR, pets: [TR.pets[0]] }, TR.pets[0].id, new Set()).ok, 'cannot trade your only pet');
const incoming: T.TradePet = { id: 'theirs', speciesId: 'p15', nickname: 'Foxy', xp: 1200, shiny: true };
const ap = T.applyTrade(TR, 'trade1', notActive.id, incoming)!;
ok(ap.state.pets.length === TR.pets.length && !ap.state.pets.some((p) => p.id === notActive.id) && ap.state.pets.some((p) => p.speciesId === 'p15' && p.xp === 1200 && p.shiny), 'trade swaps the pets, keeping level and shine');
ok(ap.received.id !== 'theirs' && ap.state.dex['p15'] === true, 'received pet gets a fresh id and joins the Pet-dex');
ok(T.applyTrade(ap.state, 'trade1', notActive.id, incoming) === null, 'a trade is applied only once');
const ap2 = T.applyTrade(TR, 'trade2', TR.activePetId!, incoming)!; ok(ap2.state.activePetId === ap2.received.id, 'if your active pet left, the new pet becomes active');
// Battles
ok(B.effectiveness('flower', 'tide') === 2 && B.effectiveness('tide', 'flower') === 0.5 && B.effectiveness('flower', 'ember') === 1, 'type strengths are 2× and ½');
{
  const els = Object.keys(B.BEATS) as (keyof typeof B.BEATS)[];
  ok(els.length === 9 && els.every((e) => B.BEATS[e].length === 2 && B.weakTo(e).length === 2 && !B.BEATS[e].includes(e)), 'each of the 9 types beats two and loses to two');
  ok(els.every((e) => B.BEATS[e].every((x) => !B.BEATS[x].includes(e))), 'no two types beat each other');
  const counts = els.map((e) => SPECIES.filter((x) => x.element === e).length);
  ok(counts.every((n) => n >= 8 && n <= 12), `every type has 8 to 12 pets (${counts.join(', ')})`);
}
let seed = 7; const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const mk = (id: string, lv: number, extra: Partial<B.PetLike> = {}): B.PetLike => ({ id: id + lv + rr(), speciesId: id, nickname: id, xp: 25 * lv * (lv - 1), shiny: false, ...extra });
const sim = (a: B.PetLike[], b: B.PetLike[], buffs: B.HabitBuff[] = [], opts = {}) => { const r = B.simulate(B.startBattle(a, b, buffs, opts), rr); return { over: r.battle.over, n: r.turns }; };
const commons = SPECIES.filter((x) => x.rarity === 'common').map((x) => x.id);
const spread = (lv: number) => { const t: Record<string, number> = {}; for (let k = 1; k < lv; k++) { const st = ['hp', 'atk', 'def', 'spd'][Math.floor(rr() * 4)]; t[st] = (t[st] ?? 0) + 1; } return t; };
let even = 0, strong = 0, maxTurns = 0, totalTurns = 0, powered = 0, trained = 0;
const allBuffs: B.HabitBuff[] = [{ id: 'rested', label: '', emoji: '', text: '' }, { id: 'hydrated', label: '', emoji: '', text: '' }, { id: 'energized', label: '', emoji: '', text: '' }, { id: 'cared', label: '', emoji: '', text: '' }];
for (let i = 0; i < 300; i++) {
  const team = (lv = 6) => [0, 1, 2].map(() => mk(commons[Math.floor(rr() * commons.length)], lv, { train: spread(lv) }));
  const r1 = sim(team(), team()); if (r1.over === 'win') even++; maxTurns = Math.max(maxTurns, r1.n); totalTurns += r1.n;
  const r2 = sim(team(10), team(6)); if (r2.over === 'win') strong++;
  const r3 = sim(team(), team(), allBuffs, { care: 1.3, streak: 7 }); if (r3.over === 'win') powered++;
  const untrained = [0, 1, 2].map(() => mk(commons[Math.floor(rr() * commons.length)], 6));
  const r4 = sim(team(), untrained); if (r4.over === 'win') trained++;
}
ok(even > 110 && even < 190, `even teams are balanced (${Math.round(even / 3)}% wins)`);
ok(strong > 255, `higher-level team usually wins (${Math.round(strong / 3)}%)`);
ok(powered > even + 20 && powered < 270, `healthy-habit buffs help (${Math.round(powered / 3)}% vs ${Math.round(even / 3)}%)`);
ok(trained > 160, `spending stat points makes pets stronger (${Math.round(trained / 3)}% vs untrained)`);
ok(maxTurns < 45 && totalTurns / 300 > 5, `battles last a good while but end (avg ${Math.round(totalTurns / 300)} turns, longest ${maxTurns})`);
// Moves, energy, statuses
const g = B.startBattle([mk('p02', 15)], [mk('p03', 15)]);
const tide = SPECIES.find((x) => x.id === 'p02')!.element;
ok(g.mine[0].moves.length === 4 && g.mine[0].energy === 1, 'pets bring 4 moves and start with 1 energy');
const big = g.mine[0].moves.find((m) => m.cost === 3)!;
const f0 = B.playTurn(g, { type: 'move', moveId: big.id }, { type: 'move', moveId: 'tackle' }, () => 0.5);
ok(f0.some((f) => f.event.side === 'me' && f.event.move?.id === 'tackle'), 'not enough energy falls back to Tackle');
ok(f0[f0.length - 1].battle.mine[0].energy === 2, 'energy builds up every turn');
const swapB = B.startBattle([mk('p02', 5), mk('p03', 5)], [mk('p04', 5)]);
const sw = B.playTurn(swapB, { type: 'switch', index: 1 }, { type: 'move', moveId: 'tackle' }, () => 0.5);
ok(sw[0].event.kind === 'switch' && sw[sw.length - 1].battle.mi === 1, 'you can switch pets');
const quickB = B.startBattle([mk('p02', 6, { train: { spd: 0 } })], [mk('p03', 6, { train: { spd: 5 } })]);
const qf = B.playTurn(quickB, { type: 'move', moveId: 'quick' }, { type: 'move', moveId: 'tackle' }, () => 0.5);
ok(qf.find((f) => f.event.kind === 'move' || f.event.kind === 'miss')!.event.side === 'me', 'Quick Jab goes first even against a faster pet');
const burnTest = B.startBattle([mk('p02', 5)], [mk('p03', 5)]); burnTest.theirs[0].status = { type: 'burn', turns: 3 };
const bf = B.playTurn(burnTest, { type: 'move', moveId: 'tackle' }, { type: 'move', moveId: 'tackle' }, () => 0.5);
ok(bf.some((f) => f.event.kind === 'burn'), 'burns hurt at the end of the turn');
// Stats and training
const pet0 = { id: 'tr1', speciesId: 'p02', nickname: 'T', xp: 25 * 6 * 5, shiny: false, hatchedOn: '' } as any;
ok(St.pointsLeft(pet0) === 5, 'one stat point per level');
const pet1 = St.train(pet0, 'atk'); ok(St.statsFor(pet1).atk > St.statsFor(pet0).atk && St.pointsLeft(pet1) === 4, 'training raises a stat');
let pet2 = pet1; for (let i = 0; i < 10; i++) pet2 = St.train(pet2, 'hp'); ok(St.pointsLeft(pet2) === 0 && pet2.train?.hp === 4, 'cannot spend more points than earned');
ok(St.personalityOf(pet0) === St.personalityOf({ ...pet0 }), 'older pets get a stable personality');
ok(St.equippedMoves({ speciesId: 'p02', xp: 0 }).length === 2 && St.equippedMoves({ speciesId: 'p02', xp: 25 * 15 * 14 }).length === 4, 'pets learn more moves as they level');
const tog = St.toggleMove({ ...pet0, xp: 25 * 15 * 14 }, 'tackle'); ok(St.equippedMoves(tog).length >= 1, 'moves can be swapped');
let R = { ...t, battle: undefined } as GameState; const coins0b = R.coins;
const f1 = B.finishBattle(R, true, true); ok(f1.reward.coins === 20 && f1.reward.chest && f1.state.chests.length === R.chests.length + 1, 'first win: 20 coins and a Bronze chest');
R = f1.state; const f2 = B.finishBattle(R, true, false); ok(f2.reward.coins === 15 && !f2.reward.chest, 'later wins: coins only');
R = f2.state; for (let i = 0; i < 3; i++) R = B.finishBattle(R, false, true).state;
const f6 = B.finishBattle(R, true, true); ok(f6.reward.coins === 0 && !f6.reward.rewarded && B.battlesLeftToday(R) === 0, 'only 5 rewarded battles a day');
ok(B.finishBattle(A.nextDay(R), true, true).reward.chest, 'rewards reset the next day');
ok(f6.state.battle!.wins === 3 && f6.state.battle!.losses === 3, 'battle record is kept');
// Cosmetics, toys and the daily shop
let W = { ...t, coins: 1000, wardrobe: {} } as GameState;
const shop1 = Cos.shopToday(W), shop1b = Cos.shopToday(W), shop2 = Cos.shopToday(A.nextDay(W));
ok(shop1.length === Cos.SHOP_SIZE && shop1.map((c) => c.id).join() === shop1b.map((c) => c.id).join(), 'shop is the same all day');
ok(shop1.map((c) => c.id).join() !== shop2.map((c) => c.id).join(), 'shop changes the next day');
ok(['hat', 'aura', 'scene'].every((sl) => shop1.some((c) => c.slot === sl)) && !shop1.some((c) => c.slot === 'toy'), 'shop has hats, an aura and a scene, and no toys');
ok(!shop1.some((c) => c.premium || c.special || c.price <= 0), 'shop never sells premium or special items');
ok(Cos.owns(W, 'ball') && Cos.owns(W, 'meadow') && Cos.ownedToys(W).length === 1, 'everyone starts with a ball and the meadow');
const item = shop1.find((c) => c.slot === 'hat')!;
const bought = Cos.buy(W, item.id); ok(bought.ok && bought.state.coins === 1000 - item.price && Cos.owns(bought.state, item.id), 'buying takes coins and adds to wardrobe');
ok(!Cos.buy((bought as any).state, item.id).ok, 'cannot buy twice');
ok(!Cos.buy({ ...W, coins: 5 }, item.id).ok, 'cannot buy without enough coins');
const notInShop = Cos.COSMETICS.find((c) => c.price > 0 && !c.premium && !c.special && !shop1.includes(c))!; ok(!Cos.buy(W, notInShop.id).ok, 'only today’s items can be bought');
W = (bought as any).state; W = Cos.equip(W, 'hat', item.id); ok(A.activePet(W)!.look?.hat === item.id, 'hat goes on the active pet');
ok(Cos.equip(W, 'hat', 'crown') === W || A.activePet(Cos.equip(W, 'hat', 'crown'))!.look?.hat === item.id, 'cannot wear an item you don’t own');
W = Cos.equip(W, 'hat', null); ok(!A.activePet(W)!.look?.hat, 'hats come off');
const sc = shop1.find((c) => c.slot === 'scene')!; const W2 = Cos.buy({ ...W }, sc.id); ok(W2.ok && Cos.equip((W2 as any).state, 'scene', sc.id).scene === sc.id, 'scenes can be bought and set');
let gotCos = 0; for (let i = 0; i < 200; i++) if (Cos.rollChestCosmetic(W, 'gold')) gotCos++;
ok(gotCos > 90 && gotCos < 150, `gold chests often hold a cosmetic (${gotCos}/200)`);
const withChest = A.grantChest(W, 'gold', 'test', () => 0.5); const op = A.openChestById(withChest, withChest.chests.slice(-1)[0].id, () => 0.01)!;
ok(!!op.result.cosmetic && Cos.owns(op.state, op.result.cosmetic!), 'chest cosmetics land in your wardrobe');
const tp = T.toTradePet({ ...A.activePet(W)!, look: { hat: 'party' } }); ok(!('look' in tp), 'outfits stay with you when trading a pet');
// Teams
ok(Team.weekStart('2026-11-16') === '2026-11-16' && Team.weekStart('2026-11-22') === '2026-11-16' && Team.weekStart('2026-11-23') === '2026-11-23', 'weeks start on Monday');
ok(Team.teamGoal(4) === 100000 && Team.teamGoal(0) === 25000, 'team goal scales with members');
let WS = { ...newGame(), dayOffset: 0, days: {} } as GameState;
const todayK = A.todayKey(WS); const mon = Team.weekStart(todayK);
WS = { ...WS, days: { [todayK]: { ...A.today(WS), steps: 4000 }, ...(mon < todayK ? { [mon]: { ...A.today(WS), steps: 3000 } } : {}), '2000-01-03': { ...A.today(WS), steps: 99999 } } };
ok(Team.weekSteps(WS) === (mon < todayK ? 7000 : 4000), 'week steps only count this week');
// Expeditions
let E = { ...t, expedition: undefined, pets: [...t.pets.map((p) => ({ ...p, xp: 50 }))] } as GameState;
const epet = E.pets[0];
ok(!Ex.canStart(E, epet.id, 'caves').ok, 'locked places need a higher level');
const T0 = 1_000_000_000_000;
E = Ex.start(E, epet.id, 'meadow', T0);
ok(Array.isArray(E.expedition?.fights), 'a trip plans its wild fights when the pet leaves');
{
  const counts = new Set<number>();
  let inRange = true, ordered = true;
  const strong = { ...E, pets: E.pets.map((p) => ({ ...p, xp: 90000 })) } as GameState;
  for (let i = 0; i < 60; i++) {
    const f = Ex.planFights(strong, epet.id, Ex.PLACE_BY_ID.mountain, 'm' + i);
    counts.add(f.length);
    if (f.length > 5) inRange = false;
    if (f.some((x, j) => j > 0 && (x.at ?? 0) < (f[j - 1].at ?? 0))) ordered = false;
  }
  ok(inRange && counts.size >= 2, `trips have a random number of fights in range (${[...counts].join(',')})`);
  ok(ordered, 'fights happen at random spots, in order along the way');
}
E = { ...E, expedition: { ...E.expedition!, fights: [{ speciesId: 'p01', name: 'Wild', won: true, hpAfter: 70 }], koAt: undefined, planned: { foods: ['carrot'], chest: null, egg: null, item: null } } };
ok(!!E.expedition && !Ex.canStart(E, epet.id, 'meadow').ok, 'one expedition at a time');
ok(!Ex.progress(E, T0)!.done && Ex.finish(E, rr, T0) === null, 'not done right away');
ok(Math.abs(Ex.progress(E, T0 + 60 * 60_000)!.pct - 0.5) < 0.01, 'half the time is half done');
const Ewalk = A.addSteps(E, 1500); ok(Ex.progress(Ewalk, T0)!.done, 'walking the steps brings the pet home early');
ok(Ex.progress(A.addSteps(E, 750), T0 + 30 * 60_000)!.stepsLeft === 375, 'walking and waiting add up (half the steps + a quarter of the time = 75%)');
ok(Ex.progress(E, T0 + 2 * 3_600_000)!.done && !Ex.progress(E, T0 + 3_500_000)!.done, 'the timer brings the pet home too, but slower than walking');
const fin = Ex.finish(Ewalk, () => 0.01, T0)!;
ok(!fin.state.expedition && fin.loot.coins >= 15 && fin.loot.story.includes(epet.nickname), 'returning pet brings coins and a story');
ok(fin.state.pets.find((p) => p.id === epet.id)!.xp === Ewalk.pets.find((p) => p.id === epet.id)!.xp + 30, 'expedition XP comes from the steps walked');
ok(!Ex.recall(E).expedition, 'you can call a pet home early');
ok(fin.state.pets.find((p) => p.id === epet.id)!.hpPct === 70 && fin.loot.foods.length === 1, 'a won trip fight lowers HP and drops food');
{
  // Knocked out on the second of two fights: home early with a share and no chest.
  let K = { ...t, expedition: undefined, pets: t.pets.map((p) => ({ ...p, xp: 5000 })) } as GameState;
  const kp = K.pets[0];
  K = Ex.start(K, kp.id, 'caves', T0);
  K = { ...K, expedition: { ...K.expedition!, fights: [{ speciesId: 'p01', name: 'Wild A', won: true, hpAfter: 40 }, { speciesId: 'p02', name: 'Wild B', won: false, hpAfter: 0 }], koAt: 2 / 3, planned: { foods: ['carrot', 'berries'], chest: 'bronze', egg: null, item: null } } };
  ok(Ex.progress(K, T0 + 4 * 3_600_000)!.done && !Ex.progress(K, T0 + 3 * 3_600_000)!.done, 'a knocked-out pet comes home early');
  const kf = Ex.finish(K, () => 0.01, T0 + 4 * 3_600_000)!;
  ok(Ex.tripStops(K).map((x) => x.kind).join(',') === 'fight,food,fight', 'a knocked-out trip shows its fights and food, but no treasure');
  ok(kf.loot.knockedOut && !kf.loot.chest && !kf.loot.egg && kf.loot.foods.length === 1, 'knocked out keeps what it found so far, but no chest or egg');
  ok(kf.state.pets.find((p) => p.id === kp.id)!.hpPct === 0 && !Ex.canStart(kf.state, kp.id, 'meadow').ok, 'a knocked-out pet can’t go on a trip');
  ok(!Hp.usePotion(Hp.addPotions(kf.state, 'full'), kp.id, 'full').ok, 'potions can’t wake a knocked-out pet');
  const startRest = kf.state.pets.find((p) => p.id === kp.id)!.hpAt!;
  const realAt = (ms: number) => startRest - kf.state.dayOffset * 86_400_000 + ms;
  ok(startRest != null && Hp.isKnockedOut(Hp.restPets(kf.state, realAt(0)).pets.find((p) => p.id === kp.id)), 'a knocked-out pet starts resting');
  const half = Hp.restPets(kf.state, realAt(90 * 60_000));
  ok(Hp.hpPct(half.pets.find((p) => p.id === kp.id)) === 15 && Ex.canStart(half, kp.id, 'meadow').ok, 'HP comes back by itself over time (15% after 90 minutes)');
  const woke = Hp.restPets(Hp.restPets(half, realAt(3 * 3_600_000)), realAt(20 * 3_600_000));
  ok(Hp.hpPct(woke.pets.find((p) => p.id === kp.id)) === Hp.REST_UP_TO && woke.pets.find((p) => p.id === kp.id)!.hpAt == null, 'healing by itself goes all the way to full');
  const hurt = Hp.setHp(woke, kp.id, 70);
  ok(Hp.restPets(hurt, realAt(40 * 3_600_000)).pets.find((p) => p.id === kp.id)!.hpPct === undefined, 'pets above 50% heal to full over time too');
  const at50 = Hp.setHp(woke, kp.id, 50);
  const healed = Hp.usePotion(Hp.addPotions(at50, 'small'), kp.id, 'small');
  ok(healed.ok && Hp.hpPct(healed.state.pets.find((p) => p.id === kp.id)) === 100, 'a Small Potion heals half (50% + 50%)');
  const full = Hp.usePotion(Hp.addPotions(at50, 'full'), kp.id, 'full');
  ok(full.ok && full.state.pets.find((p) => p.id === kp.id)!.hpPct === undefined, 'a Full Potion heals to full');
  {
    const bb = B.startBattle([kp], [kp]);
    const hurt = { ...bb, mine: [{ ...bb.mine[0], hp: 10 }] };
    const fr = B.playTurn(hurt, { type: 'potion', heal: 50, label: 'Small Potion' }, { type: 'move', moveId: 'focus' });
    ok(fr[0].event.kind === 'heal' && fr[0].battle.mine[0].hp === 10 + Math.round(bb.mine[0].maxHp / 2), 'drinking a potion in battle heals and uses your turn');
  }
  ok(!Hp.usePotion({ ...kf.state, items: {} }, kp.id, 'small').ok, 'no potion, no heal');
  // Real fights: a strong pet usually clears the Meadow; a nearly knocked-out one often doesn't.
  let wins = 0, lowWins = 0;
  const mid = { ...K, pets: K.pets.map((p) => ({ ...p, xp: 2300 })) } as GameState; // about level 10
  for (let i = 0; i < 40; i++) {
    if (Ex.planFights(K, kp.id, Ex.PLACE_BY_ID.shrine, 'a' + i).every((f) => f.won)) wins++;
    if (Ex.planFights(Hp.setHp(mid, kp.id, 10), kp.id, Ex.PLACE_BY_ID.mountain, 'a' + i).every((f) => f.won)) lowWins++;
  }
  ok(wins > 30, `a strong pet usually wins its trip fights (${wins}/40)`);
  ok(lowWins < 30, `a hurt pet on a hard trip often gets knocked out (${lowWins}/40 made it)`);
}
// Achievements
let H = { ...t, achievements: {}, stats: {}, battle: undefined, wardrobe: {} } as GameState;
ok(!Ach.claimable(H).some((x) => x.a.id === 'win1') && Ach.claim(H, 'win1') === null, 'unfinished badges cannot be claimed');
H = B.finishBattle(H, true, false).state;
ok(Ach.claimable(H).some((x) => x.a.id === 'win1'), 'winning a battle unlocks First Victory');
const Hc = Ach.claim(H, 'win1')!; ok(Hc.coins === H.coins + 30 && Ach.badgeCount(Hc) === 1, 'claiming pays the reward and adds a badge');
ok(Ach.claim(Hc, 'win1') === null, 'a badge is claimed only once');
H = A.addSteps(Hc, 12000); ok(Ach.claimable(H).some((x) => x.a.id === 'steps10k'), 'walking unlocks step badges');
const Hch = Ach.claim(H, 'steps10k')!; ok(Hch.coins === H.coins + 30, 'step badge reward');
const fullDex = { ...H, dex: Object.fromEntries(SPECIES.map((x) => [x.id, true])) } as GameState;
const Hd = Ach.claim(fullDex, 'dexall')!; ok(!!Hd && Cos.owns(Hd, 'trophy') && Hd.chests.length === fullDex.chests.length + 1, 'completing the Pet-dex gives the Champion Laurel');
ok(Ach.ACHIEVEMENTS.length >= 25 && new Set(Ach.ACHIEVEMENTS.map((a) => a.id)).size === Ach.ACHIEVEMENTS.length, 'badge ids are unique');
// Skins
let n0 = 0; const counts: Record<string, number> = {}; let sd = 99; const srng = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 100000; i++) { const k = Sk.rollSkin(srng) ?? 'none'; counts[k] = (counts[k] ?? 0) + 1; }
ok(Math.abs(counts.mono / 1000 - 5) < 0.6 && Math.abs(counts.silver / 1000 - 3) < 0.5 && Math.abs(counts.gold / 1000 - 1.5) < 0.4 && Math.abs(counts.rainbow / 1000 - 0.5) < 0.25, `skin odds ~5/3/1.5/0.5% (${counts.mono / 1000}/${counts.silver / 1000}/${counts.gold / 1000}/${counts.rainbow / 1000})`);
let bredSkins = 0; for (let i = 0; i < 20000; i++) if (Sk.rollSkin(srng, Sk.BRED_SKIN_BOOST)) bredSkins++;
ok(Math.abs(bredSkins / 200 - 40) < 3, `nursery eggs ~40% skins, dye skins included (${bredSkins / 200}%)`);
let inherited = 0; for (let i = 0; i < 20000; i++) if (Sk.rollSkin(srng, 1, ['gold', null]) === 'gold') inherited++;
ok(inherited / 200 > 24 && inherited / 200 < 29, `a gold parent passes gold ~26% of the time (${inherited / 200}%)`);
ok(Sk.noteSkin(t, { speciesId: 'p02', skin: 'gold' }).skinDex!['p02:gold'] === true, 'skins are recorded in the Skin-dex');
// Breeding
const NOW = 2_000_000_000_000;
let Bd = { ...t, coins: 500, expedition: undefined, eggs: [], pets: [
  { id: 'mom', speciesId: 'p15', nickname: 'Foxy', xp: 1100, shiny: false, hatchedOn: '', skin: 'gold' as const },
  { id: 'dad', speciesId: 'p02', nickname: 'Flushy', xp: 1100, shiny: false, hatchedOn: '' },
  { id: 'kid', speciesId: 'p82', nickname: 'Omu', xp: 100, shiny: false, hatchedOn: '' } ], activePetId: 'mom' } as GameState;
ok(!Br.canBreed(Bd, 'mom', 'kid', NOW).ok, 'only adults (level 7+) can breed');
ok(!Br.canBreed(Bd, 'mom', 'mom', NOW).ok, 'a pet cannot breed with itself');
ok(!Br.canBreed({ ...Bd, coins: 50 }, 'mom', 'dad', NOW).ok, 'breeding costs 300 coins');
const br = Br.breed(Bd, 'mom', 'dad', () => 0.7, NOW)!;
ok(br.state.coins === 200 && br.state.eggs.length === 1 && br.egg.bred!.parentSkins[0] === 'gold', 'breeding makes an egg that remembers the parents');
ok(['p15', 'p02'].includes(br.egg.bred!.speciesId) && br.egg.rarity === SPECIES.find((x) => x.id === br.egg.bred!.speciesId)!.rarity, 'baby is a parent species with matching egg rarity');
ok(!Br.canBreed(br.state, 'mom', 'dad', NOW + 3_600_000).ok && Br.canBreed({ ...br.state, coins: 500 }, 'mom', 'dad', NOW + 25 * 3_600_000).ok, 'parents rest for 24 hours');
const sur = Br.breed(Bd, 'mom', 'dad', () => 0.01, NOW)!; ok(sur.surprise && !['p15', 'p02'].includes(sur.egg.bred!.speciesId), 'surprise babies can happen');
const surEl = SPECIES.find((x) => x.id === sur.egg.bred!.speciesId)!.element; ok(['moon', 'tide', SPECIES.find((x) => x.id === 'p02')!.element, SPECIES.find((x) => x.id === 'p15')!.element].includes(surEl), 'surprise shares a parent element');
let HB = { ...br.state, eggs: br.state.eggs.map((e) => ({ ...e, incubating: true, stepsWalked: 1e9 })) } as GameState;
const hb = A.hatch(HB, HB.eggs[0].id, () => 0.001)!;
ok(hb.pet.speciesId === br.egg.bred!.speciesId, 'the nursery egg hatches the promised species');
ok(hb.pet.skin === "gold" && !!hb.state.skinDex?.[`${hb.pet.speciesId}:gold`], 'lucky babies inherit a parent skin and fill the Skin-dex');
// Element habit bonuses
const dEl = { ...A.today(t), steps: 5000, water: 6, sleepHours: 8 };
ok(scoreDay(dEl, 'tide').water === scoreDay(dEl).water * 2, 'Tide pets double water XP');
ok(scoreDay(dEl, 'moon').sleep === scoreDay(dEl).sleep * 2, 'Moon pets double sleep XP');
ok(scoreDay(dEl, 'ember').steps === Math.floor(scoreDay(dEl).steps * 1.5), 'Ember pets give +50% walking XP');
ok(scoreDay(dEl, 'flower').bonus === scoreDay(dEl).quests, 'Flower pets double quest XP');
// Streak shields
let SH = { ...newGame(), dayOffset: 0, days: {}, pets: t.pets, activePetId: t.activePetId } as GameState;
for (let i = 0; i < 7; i++) { SH = A.setSleep(A.setWater(A.addSteps(SH, 9000), 6), 8); if (i < 6) SH = A.nextDay(SH); }
ok(A.streak(SH) === 7 && SH.shields === 1, 'a 7-day streak earns a shield');
SH = A.nextDay(A.nextDay(SH));
ok(A.streak(SH) === 0, 'missing a day breaks the streak without a shield');
const shielded = A.applyShields(SH);
ok(shielded.used === 1 && shielded.state.shields === 0 && A.streak(shielded.state) === 8, 'a shield saves the streak');
ok(A.applyShields(shielded.state).used === 0, 'shields are not used twice');
// Guild raids
{
  const Tm = require('../src/game/team');
  const bosses = new Set(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'].map((w: string) => Tm.raidBoss(w).name));
  ok(bosses.size === 4, 'a different guild boss each week for 4 weeks');
  const RB = B.startBattle([t.pets[0]], [t.pets[0]]);
  ok(B.raidDamage(RB) === 0, 'no raid damage before any hits');
  RB.theirs[0].hp = RB.theirs[0].maxHp - 30; RB.over = 'win';
  ok(B.raidDamage(RB) === 45, 'a win counts raid damage 1.5×');
  RB.theirs[0].hp = -999;
  ok(B.raidDamage(RB) <= 400, 'raid hits are capped at 400');
}
// Ranked seasons
{
  const R = require('../src/game/ranked');
  ok(R.tierFor(0).id === 'bronze' && R.tierFor(99).id === 'bronze' && R.tierFor(100).id === 'silver' && R.tierFor(5000).id === 'legend', 'ranked tiers by points');
  ok(R.tierProgress(175).next.id === 'gold' && Math.abs(R.tierProgress(175).frac - 0.5) < 1e-9 && R.tierProgress(175).need === 75, 'tier progress halfway to gold');
  ok(R.tierProgress(2000).next === null, 'legend has no next tier');
  ok(R.seasonDaysLeft(new Date('2026-11-30T10:00:00Z')) === 1 && R.seasonDaysLeft(new Date('2026-11-01T00:00:00Z')) === 30, 'season days left');
  const base = newGame();
  const leg = R.seasonReward(base, 1600).state;
  ok(leg.coins === base.coins + 500 && leg.chests.length === base.chests.length + 1 && leg.wardrobe.trophy, 'legend reward: coins, gold chest, laurel');
  const br = R.seasonReward(base, 10).state;
  ok(br.coins === base.coins + 50 && br.chests.length === base.chests.length, 'bronze reward is coins only');
}
// Seasonal events
{
  const Ev = require('../src/game/events');
  const K2 = require('../src/game/cosmetics');
  ok(Ev.eventOn('2026-11-16').key === 'harvestv2-2026', 'harvest runs in November (new reward ladder)');
  ok(Ev.eventOn('2026-12-25').key === 'winter-2026' && Ev.eventOn('2027-01-03').key === 'winter-2026', 'winter festival wraps past New Year');
  ok(Ev.eventOn('2027-01-03').start === '2026-12-01' && Ev.eventOn('2027-01-03').end === '2027-01-06', 'winter run dates');
  ok(Ev.eventOn('2026-02-10') === null, 'no event in February');
  ok(Ev.nextEvent('2026-11-16').event.id === 'winter' && Ev.nextEvent('2027-02-01').start === '2027-11-01', 'next event lookup');
  ok(K2.shopToday(newGame()).every((c: any) => !c.event), 'event items never in the shop');
  for (const e of Ev.EVENTS) for (const m of e.milestones) if (m.item) ok(!!K2.COSMETIC_BY_ID[m.item], 'event item exists: ' + m.item);
  // Tokens from quests during the event only
  const run = { start: '2026-11-01', end: '2026-11-30' };
  const full = { ...A.today(newGame()), steps: 9000, water: 8, sleepHours: 8 };
  const ES = { ...newGame(), days: { '2026-10-31': full, '2026-11-02': full, '2026-11-03': { ...full, water: 0 } } } as GameState;
  ok(Ev.eventTokens(ES, run) === 7, 'tokens: (3 quests + 1 for 5k steps) + (2 + 1), days outside the event ignored');
  const big = { ...full, steps: 26000, care: { fed: true, played: 3, treat: true }, bigTrip: true };
  ok(Ev.dayTokens(big) === 7, 'a perfect day: 3 habits + care + 2 from steps (capped) + trip = 7');
  ok(Ev.dayTokens({ ...full, care: { fed: true, played: 2, treat: true } }) === 4, 'pet care only counts when all of it is done');
  const hv = Ev.EVENTS.find((e: any) => e.id === 'harvest');
  ok(hv.milestones.map((m: any) => m.tokens).join() === '5,12,20,30,40,50' && !hv.milestones.some((m: any) => m.item === 'pie'), 'harvest ladder: no food, 5 to 50');
  const egg = hv.milestones.findIndex((m: any) => m.egg);
  const dye = hv.milestones.findIndex((m: any) => m.dye && !m.chest);
  const rich = { ...newGame(), dayOffset: 0, days: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`2026-11-${String(i + 1).padStart(2, '0')}`, big])) } as GameState;
  const Dy2 = require('../src/game/dyes');
  const inNov = { ...rich, dayOffset: Math.round((Date.parse('2026-11-20T12:00:00') - Date.now()) / 86400000) };
  if (Ev.currentEvent(inNov)) {
    const e1 = Ev.claimMilestone(inNov, egg);
    ok(e1.ok && e1.state.eggs.some((x: any) => x.skin === 'harvest'), 'the Harvest Egg reward adds an egg that hatches Harvest');
    const d1 = Ev.claimMilestone(inNov, dye);
    ok(d1.ok && Dy2.dyesOwned(d1.state, 'harvest') === 1, 'the Festival Dye reward adds a Harvest dye');
  }
}
// Pet grades
{
  let seed = 7; const rq = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const iv = St.rollIvs(rq);
  ok(Object.values(iv).every((v) => v >= 0 && v <= 15 && Number.isInteger(v)), 'quality values are 0-15');
  ok(St.gradeOf({ ivs: { hp: 15, atk: 15, def: 15, spd: 15 } }) === 100 && St.gradeOf({ ivs: { hp: 0, atk: 0, def: 0, spd: 0 } }) === 0, 'grade 0% to 100%');
  ok(St.gradeInfo(100).label === 'Perfect' && St.gradeInfo(85).stars === 3 && St.gradeInfo(40).stars === 0, 'grade labels');
  const old = { id: 'abc123', speciesId: 'p15', nickname: 'Foxy', xp: 0, shiny: false, hatchedOn: '' };
  ok(St.gradeOf(old) === St.gradeOf({ ...old }) && St.gradeOf(old) >= 0, 'older pets get a stable grade');
  ok(St.readIvs({ hp: 99, atk: -3, def: 7.4, spd: 2 })!.hp === 15 && St.readIvs({ hp: 1 }) === undefined, 'bad quality values are cleaned up');
  const perfect = St.statsFor({ speciesId: 'p15', xp: 5000, ivs: { hp: 15, atk: 15, def: 15, spd: 15 }, personality: 'gentle' });
  const zero = St.statsFor({ speciesId: 'p15', xp: 5000, ivs: { hp: 0, atk: 0, def: 0, spd: 0 }, personality: 'gentle' });
  ok(perfect.atk > zero.atk && perfect.atk <= Math.ceil(zero.atk * 1.11), 'a perfect pet is up to 10% stronger');
  const kids = Array.from({ length: 200 }, () => St.inheritIvs(rq, { hp: 15, atk: 15, def: 15, spd: 15 }, { hp: 15, atk: 15, def: 15, spd: 15 }));
  ok(kids.every((k) => Object.values(k).every((v) => v >= 5)), 'nursery babies have every stat at least 5');
  const avgKid = kids.reduce((a, k) => a + St.gradeOf({ ivs: k }), 0) / kids.length;
  ok(avgKid > 75, 'great parents make better babies (avg ' + Math.round(avgKid) + '%)');
  // Trades keep the grade
  const tp = T.toTradePet({ ...old, ivs: { hp: 1, atk: 2, def: 3, spd: 4 } } as any);
  const g0 = { ...newGame(), pets: [{ ...old, id: 'mine' }, { ...old, id: 'give' }], activePetId: 'mine' } as GameState;
  const got = T.applyTrade(g0, 'tr1', 'give', tp, rq)!.received;
  ok(got.ivs?.def === 3 && got.id !== old.id, 'traded pets keep their grade');
}
// Apple Health extras: rings, exercise, mindful, water
{
  const Sc = require('../src/game/scoring');
  let H = A.setHealthExtras(newGame(), { rings: { move: 1.2, exercise: 1, stand: 0.6 }, exerciseMin: 34, mindfulMin: 6, water: 7 });
  const dH = A.today(H);
  ok(Sc.ringsClosed(dH) === 2 && Sc.scoreDay(dH).rings === 30, 'two closed rings = 30 XP');
  ok(Sc.scoreDay(dH).mindful === 10, '5+ mindful minutes = 10 XP');
  ok(dH.water === 7, 'water syncs from Apple Health');
  ok(A.today(A.setHealthExtras(H, { water: 3 })).water === 7, 'synced water never lowers what you logged');
  const ids = B.habitBuffs(H).map((b: any) => b.id);
  ok(ids.includes('trained') && ids.includes('calm') && !ids.includes('rings'), 'trained and calm buffs; rings needs all 3');
  const H3 = A.setHealthExtras(H, { rings: { move: 1, exercise: 1, stand: 1 } });
  ok(Sc.scoreDay(A.today(H3)).rings === 60 && B.habitBuffs(H3).some((b: any) => b.id === 'rings'), 'all three rings: 60 XP and the Rings Closed buff');
  const pet = { speciesId: 'p15', nickname: 'X', xp: 3000, shiny: false };
  const calmF = B.makeFighter(pet, 'm0', [{ id: 'calm', label: '', emoji: '', text: '' }]);
  ok(calmF.calm === true, 'calm fighters are marked');
  const plain = B.makeFighter(pet, 'a').stats.atk;
  const tr = B.makeFighter(pet, 'b', [{ id: 'trained', label: '', emoji: '', text: '' }]).stats.atk;
  ok(tr > plain, 'trained raises attack');
}
// Reminders
{
  const R = require('../src/game/reminders');
  const base = newGame();
  const S0 = { ...base, pets: [{ id: 'x', speciesId: 'p1', nickname: 'Fluff', xp: 0, shiny: false, hatchedOn: '' }], activePetId: 'x' };
  const morning = new Date(); morning.setHours(9, 0, 0, 0);
  const plan = R.planReminders(S0, { now: morning.getTime() });
  ok(plan.some((r: any) => r.id === 'habits-0' && new Date(r.at).getHours() === 19), 'evening reminder tonight when habits are not done');
  ok(plan.every((r: any) => r.at > morning.getTime()), 'reminders are always in the future');
  const doneDay = A.setWater(A.setSleep(A.addSteps(S0, 9000), 8), 8);
  ok(!R.planReminders(doneDay, { now: morning.getTime() }).some((r: any) => r.id === 'habits-0'), 'no reminder tonight once habits are done');
  const late = new Date(morning); late.setHours(21);
  ok(!R.planReminders(S0, { now: late.getTime() }).some((r: any) => r.id === 'habits-0'), 'no reminder for an evening that already passed');
  ok(R.planReminders(S0, { now: morning.getTime(), inGuild: true, raidHitsLeft: 2 }).some((r: any) => r.id === 'raid') || morning.getDay() === 0 || morning.getDay() === 6, 'guild raid reminder before the weekend ends');
  ok(!R.planReminders(S0, { now: morning.getTime(), inGuild: true, raidHitsLeft: 0 }).some((r: any) => r.id === 'raid'), 'no raid reminder when out of hits');
  ok(R.planReminders({ ...S0, pets: [], activePetId: null }, { now: morning.getTime() }).length === 0, 'no reminders before you have a pet');
}
// Walking finds
{
  const W = require('../src/game/walkFinds');
  const base = { ...newGame(), pets: [{ id: 'w', speciesId: 'p1', nickname: 'W', xp: 0, shiny: false, hatchedOn: '' }], activePetId: 'w' };
  const hit = () => () => 0.1; // 0.1*100 = 10: a chest when unverified (<12), a chest when verified (8..20)
  const eggRoll = () => () => 0.01;
  const walked = A.addSteps(base, 5400);
  const r1 = W.rollWalkFinds(walked, false, hit);
  const nf = (fs: any[]) => fs.filter((f: any) => f.kind === 'chest' || f.kind === 'egg');
  ok(nf(r1.finds).length === W.MAX_FINDS_PER_DAY && nf(r1.finds).every((f: any) => f.kind === 'chest'), 'finds are capped at 3 a day');
  ok(r1.state.chests.length === walked.chests.length + 3, 'found chests land in your chest list');
  ok(W.rollWalkFinds(r1.state, false, hit).finds.length === 0, 'the same steps never roll twice');
  ok(nf(W.rollWalkFinds(walked, false, eggRoll).finds).every((f: any) => f.kind === 'chest'), 'typed-in steps never find eggs');
  ok(nf(W.rollWalkFinds(walked, true, eggRoll).finds).every((f: any) => f.kind === 'egg'), 'Apple Health steps can find eggs');
  ok(nf(W.rollWalkFinds(walked, true, eggRoll).finds).filter((f: any) => f.kind === 'egg').length === 1, 'at most one egg a day from walking');
  ok(W.rollWalkFinds(A.addSteps(base, 900), false, hit).finds.length === 0, 'nothing before the first 1,000 steps');
  const a = W.rollWalkFinds(walked, true), b = W.rollWalkFinds(walked, true);
  ok(JSON.stringify(a.finds) === JSON.stringify(b.finds), 'each 1,000-step mark has one fixed roll');
  let found = 0; for (let d = 0; d < 400; d++) { let g = A.addSteps({ ...base, pets: [{ ...base.pets[0], id: 'x' + d }] }, 10000); found += nf(W.rollWalkFinds(g, true).finds).length; }
  ok(found / 400 > 1 && found / 400 < 3, `about 1.5–2 finds on a 10k-step day (got ${(found / 400).toFixed(2)})`);
}
// Incubators
{
  const I = require('../src/game/incubators');
  let g = { ...newGame(), coins: 20000 };
  ok(I.nextIncubatorPrice(g) === 1500, 'second incubator costs 1,500');
  const r1 = I.buyIncubator(g); ok(r1.ok && r1.state.incubatorSlots === 2 && r1.state.coins === 18500, 'buying adds a slot and takes the coins');
  const r2 = I.buyIncubator(r1.state); const r3 = I.buyIncubator(r2.state);
  ok(r3.ok && r3.state.incubatorSlots === 4 && r3.state.coins === 4500, 'prices climb 1,500, 4,000, 10,000');
  ok(!I.buyIncubator(r3.state).ok && I.nextIncubatorPrice(r3.state) === null, 'no more than 4 incubators');
  ok(!I.buyIncubator({ ...newGame(), coins: 100 }).ok, 'cannot buy without enough coins');
}
// Apple Health steps warm eggs even after steps were typed in
{
  let g = { ...newGame(), eggs: [{ id: 'e', rarity: 'common', stepsWalked: 0, incubating: true, foundOn: '' }] } as any;
  g = A.addSteps(g, 6000); // typed in by hand
  const e0 = g.eggs[0].stepsWalked;
  g = A.syncHealthSteps(g, 3500); // Health is lower: nothing new walked yet
  ok(A.today(g).steps === 6000 && g.eggs[0].stepsWalked === e0, 'a lower Health count never lowers the day or warms eggs');
  g = A.syncHealthSteps(g, 4200); // walked 700 more
  ok(g.eggs[0].stepsWalked === e0 + 700 && A.today(g).steps === 6000, 'steps walked after that still warm the egg');
  g = A.syncHealthSteps(g, 7000); // passes the typed count
  ok(A.today(g).steps === 7000 && g.eggs[0].stepsWalked === e0 + 3500, 'passing the typed count raises the day too, no double counting');
  let h = { ...newGame(), eggs: [{ id: 'e', rarity: 'common', stepsWalked: 0, incubating: true, foundOn: '' }] } as any;
  h = A.syncHealthSteps(h, 2500);
  ok(h.eggs[0].stepsWalked === 2500 && A.today(h).steps === 2500, 'first Health sync of the day counts all of it');
}
// Better babies and Lucky eggs
{
  const strong = { hp: 13, atk: 12, def: 12, spd: 13 };
  const weak = { hp: 9, atk: 11, def: 8, spd: 12 };
  let seed = 7;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  let sum = 0;
  for (let i = 0; i < 2000; i++) { const v = St.inheritIvs(rng, strong, weak); sum += v.hp + v.atk + v.def + v.spd; }
  const avgGrade = (sum / 2000 / 60) * 100;
  ok(avgGrade > 75, `babies lean toward the stronger parent (average ${avgGrade.toFixed(1)}%)`);
  const lucky = St.inheritIvs(() => 0, strong, weak, 2);
  ok(lucky.hp === 15 && lucky.spd === 15 && lucky.atk === 14, 'a Lucky egg adds to every stat, capped at 15');
  const r = St.likelyGrade(strong, weak);
  ok(r.low >= 60 && r.high <= 100 && r.low < r.high, `likely grade range looks sensible (${r.low}-${r.high}%)`);
}

// Power-ups: Training Crystals and combining duplicates
{
  const pet = (id: string, ivs: any) => ({ id, speciesId: 'p01', nickname: id, xp: 900, shiny: false, hatchedOn: '', ivs }) as any;
  let g = { ...newGame(), coins: 2000, pets: [pet('a', { hp: 9, atk: 12, def: 8, spd: 12 }), pet('b', { hp: 11, atk: 6, def: 10, spd: 6 }), pet('c', { hp: 15, atk: 15, def: 15, spd: 15 })], activePetId: 'a' } as GameState;
  ok(!Pw.canUseCrystal(g, 'a', 'def').ok, 'no crystal, no power-up');
  g = Pw.buyCrystal(g, '2026-11-17');
  ok(Pw.crystalsOf(g) === 1 && g.coins === 2000 - Pw.CRYSTAL_PRICE, 'the shop sells a crystal');
  ok(Pw.buyCrystal(g, '2026-11-17') === g, 'only one crystal a day from the shop');
  g = Pw.useCrystal(g, 'a', 'def');
  ok(St.ivsOf(g.pets[0]).def === 9 && Pw.crystalsOf(g) === 0, 'a crystal adds +1 to the chosen stat');
  ok(!Pw.canUseCrystal(Pw.addCrystals(g, 1), 'c', 'hp').ok, 'a maxed stat cannot go higher');
  const prev = Pw.combinePreview(g.pets[0], g.pets[1]);
  ok(prev.after.hp === 11 && prev.after.atk === 12 && prev.bonus === 'def' && prev.after.def === 11, 'combining keeps the higher of each stat, bonus on the lowest');
  const total = (o: Record<string, number>) => Object.values(o).reduce((x, y) => x + y, 0);
  ok(total(prev.after) === 11 + 12 + 10 + 12 + 1, 'combining adds a +1 bonus');
  ok(!Pw.canCombine(g, 'b', 'a').ok, 'your active pet can’t be used up as a spare');
  const g2 = Pw.combinePets(g, 'a', 'b');
  ok(g2.pets.length === 2 && !g2.pets.some((p) => p.id === 'b') && St.gradeOf(g2.pets[0]) > St.gradeOf(g.pets[0]), 'combining removes the spare and raises the grade');
  const gg = A.grantChest(newGame(), 'gold', 'test');
  const og = A.openChestById(gg, gg.chests[0].id)!;
  ok(Pw.crystalsOf(og.state) >= 1 && (og.result.crystals ?? 0) >= 1, 'gold chests always hold a Training Crystal');
}

// Food, needs and feeding
{
  const F = require('../src/game/food');
  const C = require('../src/game/care');
  const W = require('../src/game/walkFinds');
  const pet = { id: 'fp4', speciesId: 'p01', nickname: 'Fp', xp: 900, shiny: false, hatchedOn: '' } as any;
  let g = { ...newGame(), pets: [pet], activePetId: 'fp4', coins: 1000 } as GameState;
  const t0 = Date.parse('2026-11-17T09:00:00Z');
  g = C.feed(g, 'pellets', t0);
  ok(!!A.today(g).care?.fed && F.needsFor(A.today(g), t0).food >= 60 && !g.pets[0].foodBoost, 'Pellets fill the food bar with no stat bonus');
  ok(F.needsFor(A.today(g), t0 + 5 * 3600000).food < F.needsFor(A.today(g), t0).food, 'the food bar drifts down over the day');
  ok(F.needsFor(A.today(g), t0 + 48 * 3600000).food === F.NEED_FLOOR, 'bars never go below the floor');
  g = F.addFood(g, 'sushi');
  g = C.feed(g, 'sushi', t0);
  ok(g.pets[0].foodBoost?.atk === 2.5 && F.foodCount(g, 'sushi') === 0, 'an epic food adds +2.5% to its stat');
  g = F.addFood(g, 'berries', 5);
  g = C.feed(g, 'berries', t0); g = C.feed(g, 'berries', t0);
  ok(g.pets[0].foodBoost?.hp === 1.6 && A.today(g).care?.boosts === 3, 'common food adds +0.8% each');
  const strong = { ...pet, xp: 50000, foodBoost: { atk: 10 } };
  ok(St.statsFor(strong).atk > St.statsFor({ ...pet, xp: 50000 }).atk && St.statsFor(strong).atk <= Math.ceil(St.statsFor({ ...pet, xp: 50000 }).atk * 1.1) + 1, 'a full +10% food boost is +10% on that stat');
  const fourth = C.feed(g, 'berries', t0);
  ok(fourth.pets[0].foodBoost?.hp === 1.6 && F.foodCount(fourth, 'berries') === F.foodCount(g, 'berries') - 1, 'after three stat bonuses a day, food still feeds but adds no bonus');
  {
    const fav = { ...pet, id: 'fp' }; // loves berries, dislikes mushrooms
    ok(F.tasteOf(fav).fav === 'berries' && F.boostFor(fav, F.FOOD_BY_ID.berries) === 1.6 && F.boostFor(fav, F.FOOD_BY_ID.mushroom) === Math.round(F.boostOf(F.FOOD_BY_ID.mushroom) * 5) / 10, 'favorite food doubles the boost, disliked halves it');
    ok(F.tasteKnown(fav, 'berries') === 'new' && F.tasteKnown({ ...fav, tasted: ['berries'] }, 'berries') === 'fav', 'a favorite is only shown once tried');
    ok(!!(g.pets[0].tasted?.includes('berries') && g.pets[0].tasted?.includes('sushi')), 'feeding remembers what a pet has tried');
  }
  ok(F.boostFor({ ...pet, foodBoost: { atk: 9.6 } }, F.FOOD_BY_ID.sushi) === 0.4 && F.boostFor({ ...pet, foodBoost: { atk: 10 } }, F.FOOD_BY_ID.sushi) === 0, 'food boosts stop at +10%');
  let foodFinds = 0;
  for (let d = 0; d < 300; d++) { const w = A.addSteps({ ...g, pets: [{ ...pet, id: 'f' + d }], walkFinds: undefined }, 10000); foodFinds += W.rollWalkFinds(w, false).finds.filter((f: any) => f.kind === 'food').length; }
  ok(foodFinds / 300 > 2 && foodFinds / 300 <= W.MAX_FORAGE_PER_DAY, `walks turn up food (about ${(foodFinds / 300).toFixed(1)} a 10k-step day)`);
  const played = C.play(C.play(C.play(g, t0), t0), t0);
  ok(F.needsFor(A.today(played), t0).fun >= 80, 'playing fills the fun bar');
}

// Food Market
{
  const Mk = require('../src/game/market');
  const day = '2026-11-17';
  const stock = Mk.marketFor(day);
  ok(stock.length === 5 && stock[0].special && ['rare', 'epic', 'legendary'].includes(stock[0].food.rarity), 'the market has a special plus 4 everyday foods');
  ok(JSON.stringify(Mk.marketFor(day)) === JSON.stringify(stock), 'everyone sees the same stock on the same day');
  ok(JSON.stringify(Mk.marketFor('2026-11-18')) !== JSON.stringify(stock), 'the stock changes the next day');
  let m = { ...newGame(), coins: 5000 } as GameState;
  const slot = stock[1];
  for (let i = 0; i < slot.stock; i++) { const r = Mk.buyFromMarket(m, day, slot.food.id); if (r.ok) m = r.state; }
  ok(F_count(m, slot.food.id) === slot.stock && !Mk.buyFromMarket(m, day, slot.food.id).ok, 'market stock runs out for the day');
  ok(Mk.buyFromMarket(m, '2026-11-18', slot.food.id).ok === Mk.marketFor('2026-11-18').some((x: any) => x.food.id === slot.food.id), 'stock resets the next day');
  ok(Mk.nextDay('2026-11-30') === '2026-12-01', 'tomorrow rolls over months');
}

// Merging the phone and web saves
{
  const egg = (id: string, w = 0) => ({ id, rarity: 'common', stepsWalked: w, incubating: true, foundOn: '' }) as any;
  const base = { ...newGame(), coins: 100, eggs: [egg('e1'), egg('e2')], chests: [{ id: 'c1', kind: 'bronze', earnedOn: '', reason: '' }] } as GameState;
  // Phone: walked 3,000 steps (egg warms) and earned 50 coins.
  const phone = { ...base, coins: 150, eggs: [egg('e1', 3000), egg('e2')] } as GameState;
  // Web: hatched e2, opened the chest, spent 30 coins, got a new egg.
  const web = { ...base, coins: 70, eggs: [egg('e1'), egg('e3')], chests: [] } as GameState;
  const m = mergeSaves(base, phone, web);
  ok(m.eggs.find((e) => e.id === 'e1')?.stepsWalked === 3000, 'merge keeps the egg steps walked on the phone');
  ok(!m.eggs.some((e) => e.id === 'e2'), 'merge keeps an egg hatched on the other device hatched');
  ok(m.eggs.some((e) => e.id === 'e3'), 'merge keeps a new egg from the other device');
  ok(m.chests.length === 0, 'merge keeps an opened chest opened');
  ok(m.coins === 120, `merge adds coin changes from both sides (got ${m.coins})`);
  const m2 = mergeSaves(base, web, phone);
  ok(m2.coins === 120 && m2.eggs.length === 2, 'merge gives the same result in either direction');
  const d = '2026-11-16';
  const a = { ...base, days: { [d]: { steps: 4000, sleepHours: 7, water: 2, workoutMinutes: 0, meals: [] } } } as GameState;
  const b = { ...base, days: { [d]: { steps: 2500, sleepHours: 0, water: 5, workoutMinutes: 0, meals: [] } } } as GameState;
  const md = mergeSaves(base, a, b).days[d];
  ok(md.steps === 4000 && md.water === 5 && md.sleepHours === 7, 'merge keeps the higher value of each habit');
}
// Live battles: both phones replay the same history and see the same battle
{
  const g = newGame();
  const sp = SPECIES.slice(0, 3);
  const mk = (i: number, n: string) => ({ id: `${n}${i}`, speciesId: sp[i].id, nickname: `${n}${i}`, xp: 900 + i * 300, shiny: false }) as B.PetLike;
  const cT: B.LiveTeam = { pets: [mk(0, 'c'), mk(1, 'c')], buffs: [], care: 1, streak: 2 };
  const oT: B.LiveTeam = { pets: [mk(1, 'o'), mk(2, 'o')], buffs: [], care: 1, streak: 0 };
  const hist: B.LiveTurn[] = [];
  let r = B.liveReplay(cT, oT, 'seed123', hist);
  for (let i = 0; i < 60 && !r.battle.over; i++) {
    const c = B.aiAction(r.battle, 'me');
    const o = B.aiAction(r.battle, 'them');
    hist.push({ c, o });
    r = B.liveReplay(cT, oT, 'seed123', hist);
  }
  ok(!!r.battle.over, 'a live battle finishes');
  const again = B.liveReplay(cT, oT, 'seed123', JSON.parse(JSON.stringify(hist)));
  ok(JSON.stringify(again.battle) === JSON.stringify(r.battle), 'replaying the same live history gives the same battle on both phones');
  const f = B.flipBattle(r.battle);
  ok(f.mine[0].nickname === 'o0' || f.mine[0].nickname === 'o1', 'the opponent sees their own pets on their side');
  ok((r.battle.over === 'win') === (f.over === 'lose'), 'the opponent sees the opposite result');
  const ff = B.flipFrames(r.last);
  ok(ff.every((x, i) => x.event.side !== r.last[i].event.side), 'flipped events swap sides');
  ok(!r.last.some((x) => /They send out|Go /.test(x.event.text ?? '')), 'faint lines read the same from both sides');
  const team = B.liveTeamFrom(g, g.pets.map((p) => p.id));
  ok(team.pets.length === Math.min(3, g.pets.length) && Array.isArray(team.buffs), 'a live team is built from your pets and today\'s buffs');
}
// Wild pets on walks
{
  const W = require('../src/game/walkFinds');
  const g0 = { ...t, wildPending: [], walkFinds: undefined, days: {} } as GameState;
  let wilds = 0;
  for (let d = 0; d < 200; d++) {
    const g = A.addSteps({ ...g0, pets: [{ ...g0.pets[0], id: 'w' + d }] }, 10000);
    wilds += W.rollWalkFinds(g, true).state.wildPending?.length ?? 0;
  }
  ok(wilds / 200 > 1 && wilds / 200 <= W.MAX_WILD_PER_DAY, `about 1-2 wild pets on a 10k-step day (got ${(wilds / 200).toFixed(2)})`);
  const g = W.rollWalkFinds(A.addSteps(g0, 30000), true, () => () => 0.001).state;
  ok((g.wildPending ?? []).length === W.MAX_WILD_PER_DAY, 'no more than 3 wild pets a day');
  const w = g.wildPending![0];
  const before = g.coins;
  const win = Wd.resolveWild(g, w.id, true, () => 0.05);
  ok(win.reward!.coins > 0 && win.state.coins === before + win.reward!.coins && !win.state.wildPending!.some((x) => x.id === w.id), 'beating a wild pet pays coins and it leaves');
  ok(!!win.reward!.joined && win.state.pets.length === g.pets.length + 1, 'sometimes the wild pet joins your team');
  const lose = Wd.resolveWild(g, w.id, false);
  ok(!lose.reward && lose.state.coins === g.coins && lose.state.wildPending!.length === 2, 'losing means it runs off with nothing');
  ok(Wd.letGo(g, w.id).wildPending!.length === 2, 'you can let a wild pet go');
}
// Sky Tower
{
  const g = { ...t, tower: undefined, chests: [], items: {} } as GameState;
  const tw = Tw.towerOf(g);
  ok(tw.floor === 0 && Tw.canClimb(g).ok, 'a fresh tower starts at floor 0');
  ok(Tw.themeFor('2026-11-16').id !== Tw.themeFor('2026-11-23').id, 'the tower theme changes every week');
  ok(Tw.floorTeam(g, 1).length === 2 && Tw.floorTeam(g, 5).length === 3 && JSON.stringify(Tw.floorTeam(g, 5)) === JSON.stringify(Tw.floorTeam(g, 5)), 'floors have fixed themed teams (2 pets low, 3 higher)');
  ok(Tw.floorTeam(g, 10)[0].nickname.startsWith('Boss'), 'floor 10 has a boss');
  let r = Tw.finishFloor(g, true);
  ok(r.state.tower!.floor === 1 && !!r.state.tower!.choose && r.coins === Tw.coinsFor(1), 'clearing a floor pays coins and offers a blessing');
  ok(Tw.blessingChoices(r.state).length === 3 && Tw.blessingChoices(r.state)[0].id === 'heal', 'three blessings to pick from, healing always one of them');
  let g2 = Tw.chooseBlessing(r.state, 'surge');
  ok(!g2.tower!.choose && g2.tower!.blessings.includes('surge'), 'picking a blessing keeps it for the week');
  const b0 = B.startBattle([g.pets[0]], Tw.floorTeam(g, 2));
  ok(Tw.bless(b0, ['surge']).mine[0].stats.atk > b0.mine[0].stats.atk, 'Power Surge raises attack');
  g2 = { ...g2, tower: { ...g2.tower!, floor: 2 } };
  r = Tw.finishFloor(g2, true);
  ok(r.chest === 'bronze' && r.state.chests.length === 1, 'floor 3 gives a Bronze chest');
  const healed = Tw.chooseBlessing(Hp.setHp(r.state, r.state.pets[0].id, 20), 'heal');
  ok(Hp.hpPct(healed.pets[0]) === 50, 'Second Wind heals 30%');
  const lost = Tw.finishFloor(healed, false);
  ok(lost.state.tower!.floor === 3 && !Tw.canClimb(lost.state).ok, 'losing ends the climb for today but keeps your floor');
  const nd = A.nextDay(lost.state);
  ok(Tw.towerOf(nd).restDay !== A.todayKey(nd), 'the rest is over the next day');
  const top = Tw.finishFloor({ ...healed, tower: { ...healed.tower!, floor: 9 } }, true);
  ok(top.chest === 'rainbow' && top.crystals === 2 && !top.state.tower!.choose && !Tw.canClimb(top.state).ok, 'the boss gives a Rainbow Chest and crystals, and the tower is done');
}

console.log('\nEgg basket');
{
  const base = newGame();
  const full = { ...base, eggs: Array.from({ length: A.EGG_BASKET }, (_, i) => ({ ...A.newEgg(base, 'common'), id: `b${i}` })) };
  ok(A.basketFull(full), `the basket holds ${A.EGG_BASKET}`);
  const r = A.addEgg(full, 'rare');
  ok(r.coins === A.EGG_COINS.rare && r.state.eggs.length === A.EGG_BASKET && r.state.coins === full.coins + A.EGG_COINS.rare, 'a new egg in a full basket becomes coins');
  const inc = { ...full, eggs: full.eggs.map((e, i) => (i === 0 ? { ...e, incubating: true } : e)) };
  ok(!A.basketFull(inc) && A.addEgg(inc, 'common').coins === 0, 'eggs in an incubator do not count toward the basket');
  // A full basket: chests turn their egg into coins and say so.
  let saw = false;
  for (let i = 0; i < 40 && !saw; i++) {
    const g = A.grantChest(full, 'silver', 'test');
    const o = A.openChestById(g, g.chests[g.chests.length - 1].id)!;
    if (o.result.basketFull) saw = o.result.eggRarity === null && o.state.eggs.length === A.EGG_BASKET;
  }
  ok(saw, 'a Silver chest opened with a full basket gives coins instead of an egg');
  ok(stepsToHatch('common') === 3 * 1300 && stepsToHatch('legendary') === 25 * 1300, 'eggs take longer to hatch (Common 3 km, Legendary 25 km)');
  ok(CHESTS.bronze.eggChance === 10, 'Bronze chests have a 10% egg chance');
}
{
  const Pw2 = require('../src/game/powerups');
  const g = { ...newGame(), items: { [Pw2.CRYSTAL]: 5, 'Moon Seed': 1 } };
  const t = C.treat(g);
  ok(t.items[Pw2.CRYSTAL] === 5 && t.items['Moon Seed'] === 0, 'Treat uses a trinket, never a Training Crystal');
  ok(C.trinketCount({ ...newGame(), items: { [Pw2.CRYSTAL]: 3 } }) === 0 && C.treat({ ...newGame(), items: { [Pw2.CRYSTAL]: 3 } }).items[Pw2.CRYSTAL] === 3, 'crystals alone do not count as treats');
}
{
  // Trade requests: friends' cards carry pet ids and trip flags; the asked-for pet is a small snapshot.
  const mk = (id: string, nickname: string) => ({ id, speciesId: 'p01', nickname, xp: 400, shiny: false, hatchedOn: '2026-11-01' }) as any;
  let g: GameState = { ...newGame(), pets: [mk('pA', 'Ace'), mk('pB', 'Bun'), mk('pC', 'Cog')], activePetId: 'pA' };
  g = { ...g, expedition: { petId: 'pC', placeId: 'meadow', startedAt: Date.now(), startSteps: 0 } as any };
  const card = buildCard(g);
  ok(card.team.every((p) => !!p.id), 'friend cards include each pet id');
  ok(card.team.find((p) => p.id === 'pC')?.away === true && !card.team.find((p) => p.id === 'pB')?.away, 'a pet on a trip shows as away on the card');
  const want = T.toWantPet(card.team.find((p) => p.id === 'pB')!)!;
  ok(want.id === 'pB' && JSON.stringify(want).length < 600 && !(want as any).moves, 'the asked-for pet is a small snapshot that fits the trade check');
  ok(T.toWantPet({ speciesId: 'p01', nickname: 'Old', xp: 1, shiny: false }) === null, 'pets on old cards (no id) cannot be asked for');
  const busy = new Set<string>();
  ok(T.canGive(g, g.activePetId!, busy).ok, 'you can give your active pet when a friend asks for it');
  ok(!T.canGive(g, 'pC', busy).ok && !T.canOffer(g, 'pC', busy).ok, 'a pet on a trip cannot be traded');
  ok(!T.canGive(g, 'pB', new Set(['pB'])).ok, 'a pet already in another trade cannot be given');
  ok(!T.canGive({ ...g, pets: [g.pets[0]] }, g.pets[0].id, busy).ok, 'you cannot give away your only pet');
  // Accepting completes the swap through the usual path: the asker gets the friend's pet.
  const got = T.applyTrade(g, 'req1', 'pB', { id: 'x9', speciesId: 'p15', nickname: 'Kitsune', xp: 5000, shiny: false });
  ok(!!got && !got.state.pets.some((p) => p.id === 'pB') && got.state.pets.some((p) => p.speciesId === 'p15'), 'an accepted request swaps the pets');
}
{
  // Trained pets arrive as trained: points, food boosts and moves travel with them (checked).
  const mk = { id: 'tA', speciesId: 'p15', nickname: 'Foxy', xp: 5000, shiny: false, hatchedOn: '2026-11-01', train: { atk: 3, spd: 2 }, foodBoost: { hp: 2.5 }, moves: ['beam', 'tackle'] } as any;
  const tp = T.toTradePet(mk);
  ok(JSON.stringify(tp).length < 600, 'a trained pet still fits the trade size check');
  const g: GameState = { ...newGame(), pets: [{ id: 'm1', speciesId: 'p01', nickname: 'Mine', xp: 10, shiny: false, hatchedOn: '' } as any, { id: 'm2', speciesId: 'p01', nickname: 'Two', xp: 10, shiny: false, hatchedOn: '' } as any], activePetId: 'm1' };
  const r = T.applyTrade(g, 'tt1', 'm2', tp)!;
  ok(r.received.train?.atk === 3 && r.received.train?.spd === 2, 'training points stay with a traded pet');
  ok(r.received.foodBoost?.hp === 2.5 && r.received.moves?.join() === 'beam,tackle', 'food boosts and chosen moves stay with a traded pet');
  ok(St.statsFor(r.received).atk === St.statsFor(mk).atk, 'a traded pet has the same stats it had before');
  const cheat = T.applyTrade(g, 'tt2', 'm2', { ...tp, xp: 0, train: { atk: 50 }, foodBoost: { atk: 999 }, moves: ['eclipse'] })!;
  ok(!cheat.received.train && (cheat.received.foodBoost?.atk ?? 0) <= 10 && !cheat.received.moves, 'a traded pet cannot arrive with more training, boosts or moves than it could have');
}
{
  // New player intro: starter egg odds, hatching, age check, goals, unlocks.
  let seed = 42; const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const n = 20000; const count: Record<string, number> = {}; let skins = 0;
  for (let i = 0; i < n; i++) { const e = In.rollStarterEgg(rng); count[e.rarity] = (count[e.rarity] ?? 0) + 1; if (e.skin) skins++; }
  ok(Math.abs(count.common / n - 0.85) < 0.015 && Math.abs((count.uncommon ?? 0) / n - 0.12) < 0.01 && Math.abs((count.rare ?? 0) / n - 0.03) < 0.006, 'starter eggs: 85% common, 12% uncommon, 3% rare');
  ok(Math.abs(skins / n - 0.09) < 0.008 && !count.epic && !count.legendary, 'starter skins about 9% (Ink 5, Silver 3, Gold 1), never epic or legendary');
  const h = In.hatchStarter(newGame(), { rarity: 'uncommon', skin: 'gold' }, rng);
  ok(h.state.pets.length === 1 && h.state.activePetId === h.pet.id && h.pet.skin === 'gold' && h.state.chests.length === 1 && !!h.state.onboard?.hatched, 'hatching the starter gives an active pet with its skin and a welcome chest');
  const yr = new Date().getFullYear();
  ok(In.tooYoung(yr - 12) && !In.tooYoung(yr - 13) && !In.tooYoung(yr - 30), 'under 13 by year is turned away; 13 and up can play');
  ok(In.suggestGoal(4700) === 5200 && In.suggestGoal(10000) === 11000 && In.suggestGoal(0) === In.ACTIVITY_GOAL.low, 'suggested goal is a little above the 4-week average');
  // Personal goals carry into today's quests; past days keep the goals they had.
  const g: GameState = { ...h.state, goals: { steps: 5200, water: 8 } };
  ok(dailyQuests(A.today(g))[0].label === 'Walk 5,200 steps', 'today’s walking quest uses your own goal');
  const walked = A.addSteps(g, 5200);
  ok(dailyQuests(A.today(walked))[0].done && A.today(walked).stepGoal === 5200, 'reaching your own goal finishes the quest, and the day remembers it');
  ok(dailyQuests({ ...A.today(newGame()), stepGoal: undefined, waterGoal: undefined, steps: 8000, water: 6 })[1].done, 'old days keep the old 8,000 / 6 glass goals');
  // Weekly goal: up after a strong week, down after a slow one.
  const monday = new Date(2026, 10, 16, 9);
  const key = (o: number) => { const d = new Date(monday); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const weekOf = (steps: number) => Object.fromEntries(Array.from({ length: 7 }, (_, i) => [key(-1 - i), { ...A.today(newGame()), steps, stepGoal: 6000 }]));
  const base: GameState = { ...newGame(), goals: { steps: 6000, water: 8, auto: true, week: '2026-11-09' } };
  ok(In.adjustGoal({ ...base, days: weekOf(7000) }, monday, key).goals!.steps === 6300, 'a strong week raises the goal about 5%');
  ok(In.adjustGoal({ ...base, days: weekOf(1000) }, monday, key).goals!.steps === 5700, 'a slow week lowers it about 5%');
  ok(In.adjustGoal(In.adjustGoal({ ...base, days: weekOf(7000) }, monday, key), monday, key).goals!.steps === 6300, 'the goal changes only once a week');
  // Unlocks: new players open things one at a time; older saves keep everything.
  const fresh = h.state;
  ok(!Un.unlocked(fresh, 'trips') && !Un.unlocked(fresh, 'battles') && Un.nextUnlock(fresh)?.id === 'shop', 'a new player starts with the core game; shops open next');
  const lv3 = { ...fresh, pets: fresh.pets.map((p) => ({ ...p, xp: 200 })) };
  ok(Un.unlocked(lv3, 'shop') && Un.unlocked(lv3, 'trips') && !Un.unlocked(lv3, 'battles') && Un.newUnlock(lv3)?.id === 'shop', 'level 3 opens shops and trips, one card at a time');
  ok(Un.newUnlock(Un.markSeen(lv3, 'shop'))?.id === 'trips', 'after the shop card comes the trips card');
  ok(!Un.levelMoment(fresh) && !Un.levelMoment(Un.markLevelShown(fresh)), 'no level-up pop-up until something new is reached');
  const lm = Un.levelMoment(Un.markLevelShown(fresh, 1) && { ...Un.markLevelShown(fresh, 1), pets: lv3.pets });
  ok(lm?.level === 3 && lm.unlocks.map((f) => f.id).join() === 'shop,trips', 'jumping to level 3 shows one pop-up with both missed unlocks');
  const lv7 = { ...Un.markLevelShown(fresh, 6), onboard: { ...Un.markLevelShown(fresh, 6).onboard, seen: ['shop', 'trips', 'battles', 'guild', 'tower'] }, pets: fresh.pets.map((p) => ({ ...p, xp: 1100 })) };
  const m7 = Un.levelMoment(lv7);
  ok(m7?.level === 7 && !m7.unlocks.length && m7.next?.id === 'breeding', 'a plain level-up shows what is coming next');
  ok(!Un.levelMoment(Un.markLevelShown(lv7, 7)), 'each level only pops up once');
  const old = A.cleanSave({ ...newGame(), pets: [{ id: 'x', speciesId: 'p01', nickname: 'Old', xp: 0, shiny: false, hatchedOn: '' } as any], activePetId: 'x' });
  ok(!!old.onboard?.legacy && Un.unlocked(old, 'breeding') && !Un.newUnlock(old) && In.needsIntro(old), 'older saves keep everything open and only get the quick setup');
}
// Starter boost: double habit coins until level 6
{
  const lowLv = { ...R, coins: 0, days: {}, pets: R.pets.map((p) => ({ ...p, xp: 0 })) };
  const a1 = A.updateToday(lowLv, (d) => ({ ...d, steps: 4000 }));
  ok(lowLv.pets.length > 0 && A.starterBoost(lowLv), 'new players get the starter boost');
  const big = { ...lowLv, pets: lowLv.pets.map((p) => ({ ...p, xp: 99999 })) };
  const a2 = A.updateToday(big, (d) => ({ ...d, steps: 4000 }));
  ok(!A.starterBoost(big) && a2.coins > 0 && a1.coins === a2.coins * 2, 'starter boost doubles habit coins, then ends');
}
// Dyes: dye days, buying and using
{
  const Dy = require('../src/game/dyes');
  let days = 0, rare = 0;
  for (let i = 0; i < 3000; i++) { const d = Dy.dyeOfDay(`2027-01-${i}`); if (d) { days++; if (d.rarity !== 'common' && d.rarity !== 'uncommon') rare++; } }
  ok(Math.abs(days / 3000 - 1 / 3) < 0.03, `about 1 day in 3 is a dye day (${(days / 30).toFixed(1)}%)`);
  ok(Math.abs(rare / days - 0.34) < 0.05, 'about a third of shop dyes are rare or better');
  ok(!Dy.DYES.some((d: any) => ['silver', 'gold', 'rainbow'].includes(d.skin)), 'Silver, Gold and Rainbow stay hatch-only');
  let day = ''; for (let i = 0; i < 50 && !day; i++) if (Dy.dyeOfDay(`2027-02-${i}`)) day = `2027-02-${i}`;
  const d = Dy.dyeOfDay(day);
  const base = { ...R, coins: 20000, items: {}, boughtDye: undefined };
  const b = Dy.buyDye(base, day);
  ok(b.ok && b.state.coins === 20000 - Dy.DYE_PRICE[d.rarity] && Dy.dyesOwned(b.state, d.skin) === 1, 'buying the day’s dye costs its rarity price');
  ok(!Dy.buyDye(b.state, day).ok, 'one dye per dye day');
  const pet = b.state.pets[0];
  const u = Dy.useDye(b.state, pet.id, d.skin);
  ok(u.ok && u.state.pets[0].skin === d.skin && Dy.dyesOwned(u.state, d.skin) === 0 && u.state.skinDex[`${pet.speciesId}:${d.skin}`], 'using a dye gives the pet that skin for good and logs it');
}
// Pet wishes
{
  const Wi = require('../src/game/wishes');
  let two = 0, ok9 = true;
  for (let i = 0; i < 900; i++) { const p = Wi.wishPlan(`2027-03-${i}`, 'pet'); if (p.length === 2) two++; if (p[0].at < 540 || p[0].at > 1020 || (p[1] && p[1].at <= p[0].at)) ok9 = false; }
  ok(ok9, 'the first wish shows between 9am and 5pm; a second comes later');
  ok(Math.abs(two / 900 - 1 / 3) < 0.05, `about 1 day in 3 has a second wish (${Math.round(two / 9)}%)`);
  // dayOffset makes every wish of the day visible, for testing
  let g = { ...R, dayOffset: 1, wishes: undefined } as any;
  ok(!Wi.activeWish(g), 'no wish before it is noticed');
  g = Wi.noticeWishes(g);
  const w = Wi.activeWish(g);
  ok(!!w && !w.done && w.have === 0, 'a new wish starts at zero');
  const need = Wi.WISHES[w.kind];
  g = A.updateToday(g, (d: any) => w.kind === 'walk' ? { ...d, steps: d.steps + 2500 } : w.kind === 'water' ? { ...d, water: d.water + 2 } : { ...d, care: { ...d.care, played: (d.care?.played ?? 0) + 3 } });
  ok(Wi.activeWish(g)?.done, 'doing the habit finishes the wish');
  const xp0 = g.pets.find((p: any) => p.id === g.activePetId).xp, c0 = g.coins;
  const gr = Wi.grantWish(g);
  ok(gr.pets.find((p: any) => p.id === g.activePetId).xp === xp0 + 25 && gr.coins === c0, 'granting gives +25 XP and no coins');
  ok(Wi.activeWish(gr)?.index !== w.index, 'a granted wish goes away');
}
// Lucky Wheel
{
  const Wh = require('../src/game/wheel');
  ok(Wh.SLOTS.reduce((a: number, b: any) => a + b.odds, 0) === 100, 'wheel odds add up to 100');
  let g = { ...R, wheel: undefined } as any;
  g = A.updateToday(g, (d: any) => ({ ...d, steps: 0, water: 0, sleepHours: 0 }));
  ok(Wh.spinsLeft(g) === 0 && !Wh.spin(g), 'no spin until the 3 habits are done');
  g = A.updateToday(g, (d: any) => ({ ...d, steps: 20000, water: 20, sleepHours: 8 }));
  ok(Wh.spinsLeft(g) === 1, 'finishing the habits earns one spin');
  let seed = 3; const rq = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = Wh.spin(g, rq);
  ok(!!r && Wh.spinsLeft(r.state) === 0 && r.state.wheel.used === 1, 'one spin a day');
  const counts: Record<string, number> = {};
  for (let i = 0; i < 4000; i++) { const x = Wh.spin(g, rq); counts[x.prize.kind] = (counts[x.prize.kind] ?? 0) + 1; }
  ok(Math.abs((counts.dye ?? 0) / 4000 - 0.06) < 0.015 && Math.abs((counts.egg ?? 0) / 4000 - 0.03) < 0.012, 'dyes about 6%, eggs about 3%');
  let gotDye = false, gotEgg = false;
  for (let i = 0; i < 400 && !(gotDye && gotEgg); i++) { const x = Wh.spin(g, rq); if (x.prize.kind === 'dye') gotDye = Object.keys(x.state.items).some((k) => k.endsWith(' Dye')); if (x.prize.kind === 'egg') gotEgg = x.state.eggs.length > g.eggs.length || x.state.coins > g.coins; }
  ok(gotDye && gotEgg, 'dye and egg prizes land in the Bag and the Eggs tab');
}

// Rainbow Chest: super rare, always Epic or Legendary
{
  const L = require('../src/game/loot');
  const A2 = require('../src/game/actions');
  let ok2 = true;
  for (let i = 0; i < 300; i++) { const r = L.openChest('rainbow'); if (!r.eggRarity || !['epic', 'legendary'].includes(r.eggRarity) || r.coins < 500) ok2 = false; }
  ok(ok2, 'Rainbow Chests always hold an Epic or Legendary egg and 500+ coins');
  const base = require('../src/game/seed').newGame();
  if (base) {
    let ups = 0, n = 4000;
    for (let i = 0; i < n; i++) {
      const s0 = { ...base, chests: [{ id: 'g', kind: 'gold', from: 'test' }], eggs: [] };
      const r = A2.openChestById(s0, 'g');
      if (r.result.upgraded) ups++;
    }
    ok(Math.abs(ups / n - 1 / 40) < 0.012, `about 1 in 40 Gold chests turn into a Rainbow Chest (${(ups / n * 100).toFixed(1)}%)`);
    const s1 = { ...base, chests: [{ id: 'r', kind: 'rainbow', from: 'test' }], eggs: [] };
    const o = A2.openChestById(s1, 'r');
    ok(o.result.crystals >= 2 && o.result.potions.full === 1, 'Rainbow Chests give 2-3 crystals and a Full Potion');
  }
}

// Rainbow Chests can't be farmed: one per source per period
{
  const A3 = require('../src/game/actions');
  const g0 = require('../src/game/seed').newGame();
  const a1 = A3.grantRainbow(g0, 'tower', '2027-01-04', 'top');
  const a2 = A3.grantRainbow(a1.state, 'tower', '2027-01-04', 'top again');
  ok(a1.kind === 'rainbow' && a2.kind === 'gold' && a2.state.chests.filter((c: any) => c.kind === 'rainbow').length === 1, 'the tower gives one Rainbow Chest a week (a repeat gives Gold)');
  const a3 = A3.grantRainbow(a2.state, 'tower', '2027-01-11', 'next week');
  ok(a3.kind === 'rainbow', 'a new tower week can give another');
  let ups = 0;
  let st = { ...g0, eggs: [] };
  for (let i = 0; i < 400; i++) { st = { ...st, chests: [{ id: 'g' + i, kind: 'gold', reason: 't' }] }; const r = A3.openChestById(st, 'g' + i); if (r.result.upgraded) ups++; st = r.state; }
  ok(ups <= 1, `lucky Gold chests turn Rainbow at most once a week (${ups})`);
}

// Choosing who goes in after a faint
{
  const B2 = require('../src/game/battle');
  const mk = (id: string, sp: string) => ({ id, speciesId: sp, nickname: id, xp: 5000 });
  let b = B2.startBattle([mk('a', 'p01'), mk('b', 'p02'), mk('c', 'p03')], [mk('x', 'p04'), mk('y', 'p05')]);
  b = { ...b, mine: b.mine.map((f: any, i: number) => (i === 0 ? { ...f, hp: 1 } : f)) };
  let guard = 0;
  while (!b.over && b.mine[0].hp > 0 && guard++ < 20) { const fr = B2.playTurn(b, { type: 'move', moveId: b.mine[0].moves[0].id }, B2.aiAction(b, 'them')); b = fr[fr.length - 1].battle; }
  ok((b.choose ?? []).includes('me') && b.mi === 1, 'after a faint with 2 pets left, you get to choose (next in line shows for now)');
  const fr2 = B2.playTurn(b, { type: 'move', moveId: b.mine[2].moves[0].id, lead: 2 }, B2.aiAction(b, 'them'));
  ok(fr2[0].event.kind === 'switch' && fr2[0].battle.mi === 2 && !fr2[fr2.length - 1].battle.choose?.includes('me'), 'the pet you pick goes in for free before the turn');
}

// Short numbers for tight spots
{
  const { shortNumber } = require('../src/lib/shortNumber');
  ok(shortNumber(999) === '999' && shortNumber(1500) === '1.5K' && shortNumber(10000) === '10K' && shortNumber(12500) === '12.5K' && shortNumber(1234567) === '1.23M' && shortNumber(1250) === '1.25K' && shortNumber(1100) === '1.1K' && shortNumber(12345) === '12.34K' && shortNumber(3e9) === '3B' && shortNumber(999999) === '999.9K', 'big numbers shorten to K, M and B');
}

// Potions during a trip
{
  const Ex2: any = Ex;
  const H2: any = Hp;
  const g0 = require('../src/game/seed').newGame();
  const pet = { id: 'tp1', speciesId: 'p01', nickname: 'Tripper', xp: 900, hpPct: 4, shiny: false, hatchedOn: '' } as any;
  let g = { ...g0, pets: [pet], activePetId: 'tp1' };
  g = H2.addPotions(g, 'full', 2);
  const place = Ex2.PLACE_BY_ID.caves;
  let started = null as any;
  for (let i = 0; i < 200 && !started; i++) { const t0 = 1_800_000_000_000 + i * 7777; const st = Ex2.start(g, pet.id, place.id, t0); if (st.expedition?.koAt) started = { st, t0 }; }
  if (started) {
    const before = started.st.expedition.koAt;
    const r = Ex2.tripPotion(started.st, 'full', started.t0 + 1000);
    ok(r.ok && r.healed > 0 && H2.potionsOf(r.state, 'full') === 1, 'a potion on a trip heals now and uses one potion');
    ok(!r.state.expedition.koAt || r.state.expedition.koAt >= before, 'after a potion the pet goes at least as far as before');
  } else ok(true, 'a potion on a trip (no knock-out trip found to test)');
  const none = Ex2.tripPotion(g, 'small');
  ok(!none.ok, 'no potion without a trip');
}

{
  // Natures: the favored stat grows faster every level, and the gap widens with level.
  const base = { speciesId: 'p15', ivs: { hp: 7, atk: 7, def: 7, spd: 7 } };
  const lo = St.natureBonus({ ...base, xp: 0, personality: 'swift' });
  const hi = St.natureBonus({ ...base, xp: 20000, personality: 'swift' });
  ok(!!lo && !!hi && lo.stat === 'spd' && hi.amount > lo.amount && hi.amount >= 5, 'Swift speed bonus grows with level');
  const sw = St.statsFor({ ...base, xp: 20000, personality: 'swift' });
  const ge = St.statsFor({ ...base, xp: 20000, personality: 'gentle' });
  ok(sw.spd > ge.spd && sw.atk === ge.atk && sw.hp === ge.hp, 'Swift only changes Speed');
  ok(St.natureBonus({ ...base, xp: 20000, personality: 'lucky' }) === null, 'Lucky has no stat bonus');
}

/* ---------- Battle rework: 9 types, new moves, signatures ---------- */
{
  const fixed = (v: number) => () => v;
  const sp = (el: string, rarity = 'common') => SPECIES.find((x) => x.element === el && (rarity === 'any' || x.rarity === rarity))!.id;
  const pet = (id: string, lv = 15, extra: Partial<B.PetLike> = {}): B.PetLike => ({ id: 'x' + id + lv, speciesId: id, nickname: id, xp: 25 * lv * (lv - 1), shiny: false, ...extra });
  const all = Object.values(St.MOVES);
  ok(all.every((m) => m.element === 'normal' || Object.keys(B.BEATS).includes(m.element)), 'every move has a real type');
  ok(SPECIES.every((x) => St.learnset(x.id).length >= 8), 'every pet can learn at least 8 moves');
  ok(SPECIES.every((x) => St.equippedMoves({ speciesId: x.id, xp: 25 * 15 * 14 }).length === 4), 'every pet brings 4 moves at level 15');
  ok(St.equippedMoves({ speciesId: sp('tide'), xp: 0, moves: ['bogus'] }).length >= 1, 'unknown saved moves fall back to a default kit');
  const sigs = SPECIES.filter((x) => x.rarity === 'epic' || x.rarity === 'legendary');
  ok(sigs.every((x) => St.SIGNATURES[x.id]?.signature), 'every Epic and Legendary pet has a signature move');
  ok(SPECIES.filter((x) => x.rarity !== 'epic' && x.rarity !== 'legendary').every((x) => !St.SIGNATURES[x.id]), 'other pets have no signature');
  // Signature: free, once per battle.
  const kit = pet('p15');
  let b = B.startBattle([kit], [pet(sp('tide'), 15)]);
  ok(B.active(b, 'me').sig?.id === 'sig_p15' && B.allMoves(B.active(b, 'me')).some((m) => m.signature), 'Kitsune brings Nine-Tail Fire');
  let fr = B.playTurn(b, { type: 'move', moveId: 'sig_p15' }, { type: 'move', moveId: 'tackle' }, fixed(0.5));
  b = fr[fr.length - 1].battle;
  ok(B.active(b, 'me').sigUsed === true && !B.allMoves(B.active(b, 'me')).some((m) => m.signature), 'a signature move works once per battle');
  // Splash hits the bench.
  b = B.startBattle([kit], [pet(sp('tide'), 30), pet(sp('ember'), 30)]);
  const benchHp = b.theirs[1].hp;
  fr = B.playTurn(b, { type: 'move', moveId: 'sig_p15' }, { type: 'move', moveId: 'tackle' }, fixed(0.5));
  ok(fr[fr.length - 1].battle.theirs[1].hp < benchHp, 'Nine-Tail Fire also hits the bench');
  // Poison: hurts every turn, cured by switching.
  b = B.startBattle([pet(sp('tide'), 20), pet(sp('ember'), 20)], [pet(sp('toxic'), 20)]);
  b.mine[0].status = { type: 'poison', turns: 99 };
  const hp0 = b.mine[0].hp;
  fr = B.playTurn(b, { type: 'move', moveId: 'focus' }, { type: 'move', moveId: 'focus' }, fixed(0.5));
  b = fr[fr.length - 1].battle;
  ok(b.mine[0].hp < hp0 && b.mine[0].status?.type === 'poison', 'poison hurts each turn and stays');
  fr = B.playTurn(b, { type: 'switch', index: 1 }, { type: 'move', moveId: 'focus' }, fixed(0.5));
  ok(!fr[fr.length - 1].battle.mine[0].status, 'switching out cures poison');
  // Guard cuts damage; super effective doubles it.
  const hit = (foeId: string, moveId: string, guard = false) => {
    const bb = B.startBattle([pet(sp('stone'), 20)], [pet(foeId, 20)]);
    bb.mine[0].energy = 5;
    if (guard) bb.theirs[0].buffs.guard = 2;
    const f = B.playTurn(bb, { type: 'move', moveId }, { type: 'move', moveId: 'focus' }, fixed(0.5)).find((x) => x.event.kind === 'move' && x.event.side === 'me');
    return f?.event.damage ?? 0;
  };
  const sameStats = SPECIES.find((x) => x.element === 'spark' && x.rarity === 'common')!.id;
  ok(hit(sameStats, 'pebble', true) < hit(sameStats, 'pebble'), 'Guard means less damage');
  const fe = B.startBattle([pet(sp('stone'), 20)], [pet(sp('spark'), 20)]);
  const fx = B.playTurn(fe, { type: 'move', moveId: 'pebble' }, { type: 'move', moveId: 'focus' }, fixed(0.5)).find((x) => x.event.side === 'me' && x.event.kind === 'move');
  ok(fx?.event.effect === 2 && /Super effective/.test(fx.event.text), 'Stone is super effective on Spark');
  // Stun can cost a turn; chill slows.
  b = B.startBattle([pet(sp('spark'), 20)], [pet(sp('frost'), 20)]);
  b.mine[0].status = { type: 'stun', turns: 2 };
  fr = B.playTurn(b, { type: 'move', moveId: 'tackle' }, { type: 'move', moveId: 'focus' }, fixed(0.1));
  ok(fr.some((x) => x.event.side === 'me' && x.event.kind === 'doze'), 'a stunned pet can lose its turn');
  // Habit perks for the new types.
  const day = { steps: 0, sleepHours: 0, water: 0, workoutMinutes: 30, meals: [], mindfulMin: 10, rings: { move: 1, exercise: 1, stand: 1 } } as any;
  ok(scoreDay(day, 'spark').workout === 60 && scoreDay(day).workout === 30, 'Spark pets double workout XP');
  ok(scoreDay(day, 'frost').mindful === 2 * scoreDay(day).mindful, 'Frost pets double mindful XP');
  ok(scoreDay(day, 'stone').rings === 2 * scoreDay(day).rings, 'Stone pets double activity-ring XP');
  const cared = { ...day, care: { fed: true, played: 3, treat: true } };
  ok(C.boostedTotal(cared, 'toxic') > C.boostedTotal(cared, 'flower') - scoreDay(cared, 'flower').bonus, 'Toxic pets double the care boost');
  ok(Tw.THEMES.length === 9 && Tw.THEMES.every((t) => /hit harder/.test(t.weakTo)), 'a tower for every type');
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
