import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FS from 'expo-file-system/legacy';
import { widgetsDirectory } from 'expo-widgets';
import PetWidget, { type PetWidgetProps } from '../widgets/PetWidget';
import TripActivity, { type TripActivityProps } from '../widgets/TripActivity';
import { PET_IMAGES } from '../components/petImages';
import type { GameState } from '../game/types';
import * as A from '../game/actions';
import * as Ex from '../game/expedition';
import * as H from '../game/hp';
import { levelFor } from '../game/scoring';
import { MOOD_INFO, moodFor } from '../game/care';

/**
 * Keeps the home screen widget and the adventure Live Activity in step with the game.
 * Called when the save changes (debounced by the caller). Errors are ignored: a widget
 * that can't update must never break the app.
 */

const copied = new Set<string>();

async function petImage(speciesId: string): Promise<string | null> {
  if (!widgetsDirectory) return null;
  const target = `${widgetsDirectory.replace(/\/$/, '')}/pet-${speciesId}.png`;
  if (copied.has(target)) return target;
  try {
    const info = await FS.getInfoAsync(target);
    if (!info.exists) {
      const mod = PET_IMAGES[speciesId];
      if (!mod) return null;
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      if (!asset.localUri) return null;
      await FS.copyAsync({ from: asset.localUri, to: target });
    }
    copied.add(target);
    return target;
  } catch {
    return null;
  }
}

let lastKey = '';

export async function syncWidgets(s: GameState, waiting: string | null): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const pet = A.activePet(s) ?? s.pets[0];
    if (!pet) return;
    const day = A.today(s);
    const tripPet = s.expedition ? s.pets.find((p) => p.id === s.expedition!.petId) : undefined;
    const shown = tripPet ?? pet;
    const image = await petImage(shown.speciesId);
    const prog = Ex.progress(s);
    const now = Date.now();
    const lastFight = s.expedition?.fights?.length ? s.expedition.fights[s.expedition.fights.length - 1] : undefined;
    const trip: PetWidgetProps['trip'] =
      prog && s.expedition
        ? {
            place: prog.place.name,
            startAt: now - Math.round(prog.place.hours * 3_600_000 * (s.expedition.koAt ?? 1) * prog.pct),
            endAt: now + prog.msLeft,
            hp: Math.round(lastFight && prog.done ? lastFight.hpAfter : H.hpPct(tripPet)),
            knockedOut: !!s.expedition.koAt,
          }
        : null;
    const props: PetWidgetProps = {
      name: shown.nickname,
      level: levelFor(shown.xp),
      mood: MOOD_INFO[moodFor(day)]?.label ?? 'Happy',
      image,
      steps: day.steps,
      stepGoal: 8000,
      waterPct: Math.min(1, day.water / 6),
      sleepPct: Math.min(1, day.sleepHours / 7),
      streak: A.streak(s),
      waiting,
      trip,
    };
    const key = JSON.stringify({ ...props, trip: trip ? { ...trip, startAt: Math.round(trip.startAt / 60000), endAt: Math.round(trip.endAt / 60000) } : null });
    if (key !== lastKey) {
      lastKey = key;
      if (trip && trip.endAt > now) {
        // One entry now and one when the pet gets home; the countdown and bar tick on their own in between.
        PetWidget.updateTimeline([
          { date: new Date(now), props },
          { date: new Date(trip.endAt), props },
        ]);
      } else {
        PetWidget.updateSnapshot(props);
      }
    }
    await syncTripActivity(s, tripPet?.nickname ?? '', image, trip);
  } catch {
    // Widgets are a bonus; never let them break the game.
  }
}

async function syncTripActivity(s: GameState, name: string, image: string | null, trip: PetWidgetProps['trip']) {
  const running = TripActivity.getInstances();
  if (!trip || !s.expedition) {
    for (const a of running) await a.end('default');
    return;
  }
  const total = trip.endAt - trip.startAt;
  const full = s.expedition.koAt ? total / s.expedition.koAt : total;
  const props: TripActivityProps = {
    name,
    place: trip.place,
    image,
    startAt: trip.startAt,
    endAt: trip.endAt,
    hp: trip.hp,
    knockedOut: trip.knockedOut,
    stops: Ex.tripStops(s).map((x) => ({ at: trip.startAt + Math.round(full * x.frac), kind: x.kind, label: x.label, won: x.won })),
  };
  if (running.length) {
    const [first, ...rest] = running;
    await first.update(props, new Date(trip.endAt));
    for (const a of rest) await a.end('immediate');
  } else if (trip.endAt > Date.now()) {
    TripActivity.start(props, undefined, new Date(trip.endAt));
  }
}
