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
import { levelFor, levelProgress, stageFor } from '../src/game/scoring';
import type { ChestKind, GameState } from '../src/game/types';

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
const starterEls = new Set(Array.from({ length: 200 }, () => A.chooseStarter(s0).pet.speciesId).map((id) => SPECIES.find((x) => x.id === id)!.element));
ok(starterEls.size === 4, 'the one starter egg can hatch every element');
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
s = A.addSteps(s, 8000 - A.today(s).steps); s = A.setWater(s, 6); s = A.addMeal(s, { name: 'a', calories: null, veggies: false }); s = A.addMeal(s, { name: 'b', calories: null, veggies: true });
ok(s.chests.length === chestsBefore + 1, 'bronze chest granted when all quests done');
s = A.addSteps(s, 500);
ok(s.chests.length === chestsBefore + 1, 'bronze chest only once per day');
const c = s.chests[0]; const r = A.openChestById(s, c.id, () => 0.01)!;
ok(r.state.chests.length === s.chests.length - 1 && r.result.coins >= CHESTS[c.kind].coins[0], 'opening chest pays coins and removes it');
const before = A.activePet(s)!.xp; s = A.setWater(s, 5);
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
ok(g0.coins === 60 && g0.chests === 0 && g0.state.coins === t.coins + 60, 'each gift pays 20 coins');
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
ok(B.effectiveness('flower', 'tide') === 1.5 && B.effectiveness('tide', 'flower') === 0.75 && B.effectiveness('flower', 'ember') === 1, 'element strengths');
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
const f1 = B.finishBattle(R, true, true); ok(f1.reward.coins === 30 && f1.reward.chest && f1.state.chests.length === R.chests.length + 1, 'first win: 30 coins and a Bronze chest');
R = f1.state; const f2 = B.finishBattle(R, true, false); ok(f2.reward.coins === 20 && !f2.reward.chest, 'later wins: coins only');
R = f2.state; for (let i = 0; i < 3; i++) R = B.finishBattle(R, false, true).state;
const f6 = B.finishBattle(R, true, true); ok(f6.reward.coins === 0 && !f6.reward.rewarded && B.battlesLeftToday(R) === 0, 'only 5 rewarded battles a day');
ok(B.finishBattle(A.nextDay(R), true, true).reward.chest, 'rewards reset the next day');
ok(f6.state.battle!.wins === 3 && f6.state.battle!.losses === 3, 'battle record is kept');
// Cosmetics, toys and the daily shop
let W = { ...t, coins: 1000, wardrobe: {} } as GameState;
const shop1 = Cos.shopToday(W), shop1b = Cos.shopToday(W), shop2 = Cos.shopToday(A.nextDay(W));
ok(shop1.length === Cos.SHOP_SIZE && shop1.map((c) => c.id).join() === shop1b.map((c) => c.id).join(), 'shop is the same all day');
ok(shop1.map((c) => c.id).join() !== shop2.map((c) => c.id).join(), 'shop changes the next day');
ok(['toy', 'hat', 'aura', 'scene'].every((sl) => shop1.some((c) => c.slot === sl)) && shop1.filter((c) => c.slot === 'toy').length >= 2, 'shop always has toys, hats, an aura and a scene');
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
ok(!!E.expedition && !Ex.canStart(E, epet.id, 'meadow').ok, 'one expedition at a time');
ok(!Ex.progress(E, T0)!.done && Ex.finish(E, rr, T0) === null, 'not done right away');
ok(Math.abs(Ex.progress(E, T0 + 30 * 60_000)!.pct - 0.5) < 0.01, 'half the time is half done');
const Ewalk = A.addSteps(E, 1500); ok(Ex.progress(Ewalk, T0)!.done, 'walking the steps brings the pet home early');
ok(Ex.progress(A.addSteps(E, 750), T0 + 15 * 60_000)!.stepsLeft === 750, 'walking and waiting both count');
ok(Ex.progress(E, T0 + 3_600_000)!.done, 'the timer brings the pet home too');
const fin = Ex.finish(Ewalk, () => 0.01, T0)!;
ok(!fin.state.expedition && fin.loot.coins >= 15 && fin.loot.story.includes(epet.nickname), 'returning pet brings coins and a story');
ok(fin.state.pets.find((p) => p.id === epet.id)!.xp === Ewalk.pets.find((p) => p.id === epet.id)!.xp + 30, 'expedition XP comes from the steps walked');
ok(!Ex.recall(E).expedition, 'you can call a pet home early');
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
ok(Math.abs(bredSkins / 200 - 30) < 2, `nursery eggs ~30% skins (${bredSkins / 200}%)`);
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
ok(!Br.canBreed({ ...Bd, coins: 50 }, 'mom', 'dad', NOW).ok, 'breeding costs 100 coins');
const br = Br.breed(Bd, 'mom', 'dad', () => 0.7, NOW)!;
ok(br.state.coins === 400 && br.state.eggs.length === 1 && br.egg.bred!.parentSkins[0] === 'gold', 'breeding makes an egg that remembers the parents');
ok(['p15', 'p02'].includes(br.egg.bred!.speciesId) && br.egg.rarity === SPECIES.find((x) => x.id === br.egg.bred!.speciesId)!.rarity, 'baby is a parent species with matching egg rarity');
ok(!Br.canBreed(br.state, 'mom', 'dad', NOW + 3_600_000).ok && Br.canBreed({ ...br.state, coins: 500 }, 'mom', 'dad', NOW + 25 * 3_600_000).ok, 'parents rest for 24 hours');
const sur = Br.breed(Bd, 'mom', 'dad', () => 0.01, NOW)!; ok(sur.surprise && !['p15', 'p02'].includes(sur.egg.bred!.speciesId), 'surprise babies can happen');
const surEl = SPECIES.find((x) => x.id === sur.egg.bred!.speciesId)!.element; ok(['moon', 'tide', SPECIES.find((x) => x.id === 'p02')!.element, SPECIES.find((x) => x.id === 'p15')!.element].includes(surEl), 'surprise shares a parent element');
let HB = { ...br.state, eggs: br.state.eggs.map((e) => ({ ...e, incubating: true, stepsWalked: 1e9 })) } as GameState;
const hb = A.hatch(HB, HB.eggs[0].id, () => 0.001)!;
ok(hb.pet.speciesId === br.egg.bred!.speciesId, 'the nursery egg hatches the promised species');
ok(hb.pet.skin === "gold" && !!hb.state.skinDex?.[`${hb.pet.speciesId}:gold`], 'lucky babies inherit a parent skin and fill the Skin-dex');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
