import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PetWidgetProps } from '../widgets/PetWidget';
import type { TripActivityProps } from '../widgets/TripActivity';
import { reportCrash } from './crashReport';
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

/**
 * The widget modules are loaded only when first needed, inside a try, so a problem with them can
 * never stop the app from starting. If they fail once, widgets are switched off for this session.
 */
type Mods = {
  Asset: typeof import('expo-asset').Asset;
  FS: typeof import('expo-file-system/legacy');
  widgetsDirectory: string | null;
  PetWidget: typeof import('../widgets/PetWidget').default;
  TripActivity: typeof import('../widgets/TripActivity').default;
};
let mods: Mods | null | undefined;

/**
 * Safety net for errors iOS raises inside widget code, which JavaScript can't catch and which close the
 * app. A marker is saved before each widget call and cleared after. If the app starts and finds the
 * marker still there, the last widget call closed the app, so widgets stay off on this phone until
 * a new build (GUARD_KEY changes with WIDGET_VERSION).
 */
const WIDGET_VERSION = 13;
const GUARD_KEY = `sproutling/widget-guard-${WIDGET_VERSION}`;
let guardChecked: boolean | undefined;
async function widgetsAllowed(): Promise<boolean> {
  if (guardChecked !== undefined) return guardChecked;
  try {
    const v = await AsyncStorage.getItem(GUARD_KEY);
    if (v === 'pending' || v === 'off') {
      if (v === 'pending') {
        reportCrash(new Error('Widgets closed the app last time; turned off on this phone'), 'widgets-guard');
        await AsyncStorage.setItem(GUARD_KEY, 'off');
      }
      guardChecked = false;
    } else guardChecked = true;
  } catch {
    guardChecked = true;
  }
  return guardChecked;
}
async function guarded<T>(fn: () => T | Promise<T>): Promise<T> {
  await AsyncStorage.setItem(GUARD_KEY, 'pending');
  try {
    return await fn();
  } finally {
    // Runs for ordinary JavaScript errors too; only a crash that closes the app leaves 'pending'.
    await AsyncStorage.setItem(GUARD_KEY, 'ok');
  }
}

/** Drops null and undefined values (deeply): iOS can't store them in the widget's shared storage. */
function noNulls<T>(v: T): T {
  if (Array.isArray(v)) return v.map(noNulls) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== null && x !== undefined) out[k] = noNulls(x);
    return out as T;
  }
  return v;
}

function load(): Mods | null {
  if (mods !== undefined) return mods;
  try {
    mods = {
      Asset: require('expo-asset').Asset,
      FS: require('expo-file-system/legacy'),
      widgetsDirectory: require('expo-widgets').widgetsDirectory ?? null,
      PetWidget: require('../widgets/PetWidget').default,
      TripActivity: require('../widgets/TripActivity').default,
    };
  } catch (e) {
    reportCrash(e, 'widgets-load');
    mods = null;
  }
  return mods;
}

async function petImage(m: Mods, speciesId: string): Promise<string | null> {
  const { widgetsDirectory, FS, Asset } = m;
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
  if (!(await widgetsAllowed())) return;
  let m: Mods | null = null;
  try {
    m = await guarded(() => load());
  } catch (e) {
    reportCrash(e, 'widgets-load');
  }
  if (!m) return;
  const { PetWidget } = m;
  try {
    const pet = A.activePet(s) ?? s.pets[0];
    if (!pet) return;
    const day = A.today(s);
    const tripPet = s.expedition ? s.pets.find((p) => p.id === s.expedition!.petId) : undefined;
    const shown = tripPet ?? pet;
    const image = await petImage(m, shown.speciesId);
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
    const props: PetWidgetProps = noNulls({
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
    });
    const key = JSON.stringify({ ...props, trip: trip ? { ...trip, startAt: Math.round(trip.startAt / 60000), endAt: Math.round(trip.endAt / 60000) } : null });
    if (key !== lastKey) {
      lastKey = key;
      if (trip && trip.endAt > now) {
        // One entry now and one when the pet gets home; the countdown and bar tick on their own in between.
        await guarded(() =>
          PetWidget.updateTimeline([
            { date: new Date(now), props },
            { date: new Date(trip.endAt), props },
          ]),
        );
      } else {
        await guarded(() => PetWidget.updateSnapshot(props));
      }
    }
    await guarded(() => syncTripActivity(m!, s, tripPet?.nickname ?? '', image, trip));
  } catch (e) {
    // Widgets are a bonus; never let them break the game.
    reportCrash(e, 'widgets-sync');
  }
}

async function syncTripActivity(m: Mods, s: GameState, name: string, image: string | null, trip: PetWidgetProps['trip']) {
  const { TripActivity } = m;
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
