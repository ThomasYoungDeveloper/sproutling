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
  PetWidget: ReturnType<typeof import('../widgets/PetWidget').makePetWidget>;
  TripActivity: ReturnType<typeof import('../widgets/TripActivity').makeTripActivity>;
};
let mods: Mods | null | undefined;

/**
 * Safety net for errors iOS raises inside widget code, which JavaScript can't catch and which close the
 * app. A marker is saved before each widget call and cleared after. If the app starts and finds the
 * marker still there, the last widget call may have closed the app. That also happens when the player
 * simply swipes the app away mid-update, so widgets are only turned off after it happens twice in a row.
 * They come back on with a new version (GUARD_KEY changes with WIDGET_VERSION).
 */
const WIDGET_VERSION = 16;
const GUARD_KEY = `sproutling/widget-guard-${WIDGET_VERSION}`;
const STRIKES_TO_STOP = 2;
let guardChecked: boolean | undefined;
async function widgetsAllowed(): Promise<boolean> {
  if (guardChecked !== undefined) return guardChecked;
  try {
    const v = (await AsyncStorage.getItem(GUARD_KEY)) ?? 'ok';
    if (v === 'off') guardChecked = false;
    else if (v.startsWith('pending')) {
      // The marker holds how many interrupted updates came before this one.
      const strikes = Number(v.split(':')[1] ?? 0) + 1;
      if (strikes >= STRIKES_TO_STOP) {
        reportCrash(new Error('Widgets were interrupted twice in a row; turned off on this phone'), 'widgets-guard');
        await AsyncStorage.setItem(GUARD_KEY, 'off');
        guardChecked = false;
      } else {
        await AsyncStorage.setItem(GUARD_KEY, `strike:${strikes}`);
        guardChecked = true;
      }
    } else guardChecked = true;
  } catch {
    guardChecked = true;
  }
  return guardChecked;
}
async function guarded<T>(fn: () => T | Promise<T>): Promise<T> {
  const before = (await AsyncStorage.getItem(GUARD_KEY).catch(() => null)) ?? 'ok';
  const strikes = before.startsWith('strike:') ? Number(before.split(':')[1]) : 0;
  await AsyncStorage.setItem(GUARD_KEY, `pending:${strikes}`);
  try {
    return await fn();
  } finally {
    // Finished (even with an ordinary error): the app is fine, so the count starts over.
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
      PetWidget: require('../widgets/PetWidget').makePetWidget(),
      TripActivity: require('../widgets/TripActivity').makeTripActivity(),
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
            startAt: now - Math.round(Ex.tripMs(s, prog.place.hours) * (s.expedition.koAt ?? 1) * prog.pct),
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
        // Redraw at each change of sky (5am, 8am, 5pm, 8pm) for the next day, even if the app isn't opened.
        const base = new Date(now);
        const marks = [5, 8, 17, 20]
          .flatMap((h) => [0, 1].map((d) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + d, h).getTime()))
          .filter((t) => t > now)
          .sort((a, b) => a - b)
          .slice(0, 4);
        await guarded(() => PetWidget.updateTimeline([{ date: new Date(now), props }, ...marks.map((t) => ({ date: new Date(t), props }))]));
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
    // Loot collected (or no trip): clear it from the Lock Screen right away.
    for (const a of running) await a.end('immediate');
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
    try {
      TripActivity.start(props, undefined, new Date(trip.endAt));
    } catch (e) {
      // iPads and phones with Live Activities turned off: nothing to show, nothing to report.
      if (!/not supported|disabled|not enabled/i.test(String((e as Error)?.message ?? e))) throw e;
    }
  }
}
