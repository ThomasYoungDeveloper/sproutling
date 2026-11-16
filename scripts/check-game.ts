import { newGame } from '../src/game/seed';
import * as A from '../src/game/actions';
import { CHESTS, oddsFor } from '../src/game/loot';
import { SPECIES, speciesOfRarity } from '../src/game/species';
import { RARITIES, stepsToHatch } from '../src/game/rarity';
import type { ChestKind } from '../src/game/types';

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
const st = A.chooseStarter(s0, 'tide', () => 0.3);
ok(st.state.pets.length === 1 && SPECIES.find((x) => x.id === st.pet.speciesId)!.rarity === 'common' && SPECIES.find((x) => x.id === st.pet.speciesId)!.element === 'tide', 'starter is a Common of the chosen element');
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
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
