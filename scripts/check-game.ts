import { newGame } from '../src/game/seed';
import * as A from '../src/game/actions';
import { CHESTS, oddsFor } from '../src/game/loot';
import { SPECIES, speciesOfRarity } from '../src/game/species';
import { RARITIES, stepsToHatch } from '../src/game/rarity';
import { buildCard, readCard } from '../src/game/card';
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
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
