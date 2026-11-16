import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Little synthesized sound effects (no audio files). Uses the Web Audio API in the browser;
 * on phones this stays silent until the native app adds its own audio.
 */

export type SoundName =
  | 'tap' | 'pop' | 'thud' | 'chime' | 'coin' | 'crack' | 'hatch' | 'chest' | 'levelup'
  | 'hit' | 'special' | 'guard' | 'win' | 'lose' | 'munch' | 'squeak' | 'bubbles' | 'notes' | 'whoosh';

const MUTE_KEY = 'sproutling/muted';
let muted = false;
let ctx: any = null;
const listeners = new Set<(m: boolean) => void>();

AsyncStorage.getItem(MUTE_KEY).then((v) => {
  muted = v === '1';
  listeners.forEach((l) => l(muted));
});

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  AsyncStorage.setItem(MUTE_KEY, m ? '1' : '0');
  listeners.forEach((l) => l(m));
}
export function onMuteChange(l: (m: boolean) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function audio(): any {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** One note: an oscillator with a quick volume envelope and an optional pitch slide. */
function tone(a: any, at: number, freq: number, dur: number, opts: { type?: string; vol?: number; slideTo?: number } = {}) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, at);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, at + dur);
  const v = (opts.vol ?? 0.18) * 0.6;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** A short burst of filtered noise, for cracks, hits and whooshes. */
function noise(a: any, at: number, dur: number, opts: { vol?: number; freq?: number; q?: number } = {}) {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = opts.freq ?? 1800;
  f.Q.value = opts.q ?? 1.2;
  const g = a.createGain();
  g.gain.value = (opts.vol ?? 0.25) * 0.6;
  src.connect(f).connect(g).connect(a.destination);
  src.start(at);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A5 = 880, D5 = 587.33, F5 = 698.46;

export function play(name: SoundName) {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  try {
    switch (name) {
      case 'tap': tone(a, t, 880, 0.06, { type: 'triangle', vol: 0.1 }); break;
      case 'pop': tone(a, t, 420, 0.09, { type: 'sine', vol: 0.18, slideTo: 900 }); break;
      case 'thud': tone(a, t, 160, 0.14, { type: 'sine', vol: 0.25, slideTo: 70 }); break;
      case 'chime': [C5, E5, G5].forEach((f, i) => tone(a, t + i * 0.06, f, 0.22, { type: 'triangle', vol: 0.14 })); break;
      case 'coin': tone(a, t, 988, 0.07, { type: 'square', vol: 0.07 }); tone(a, t + 0.07, 1319, 0.18, { type: 'square', vol: 0.07 }); break;
      case 'crack': noise(a, t, 0.08, { freq: 2500, vol: 0.3 }); tone(a, t, 300, 0.05, { type: 'square', vol: 0.05 }); break;
      case 'hatch':
        noise(a, t, 0.12, { freq: 3000, vol: 0.3 });
        [C5, E5, G5, C6].forEach((f, i) => tone(a, t + 0.12 + i * 0.09, f, 0.3, { type: 'triangle', vol: 0.15 }));
        tone(a, t + 0.5, C6, 0.6, { type: 'sine', vol: 0.12 });
        break;
      case 'chest':
        noise(a, t, 0.15, { freq: 900, vol: 0.25 });
        [G5, C6, E5 * 2].forEach((f, i) => tone(a, t + 0.12 + i * 0.07, f, 0.25, { type: 'triangle', vol: 0.12 }));
        break;
      case 'levelup': [C5, E5, G5, C6, G5, C6].forEach((f, i) => tone(a, t + i * 0.08, f, 0.2, { type: 'square', vol: 0.06 })); break;
      case 'hit': noise(a, t, 0.1, { freq: 700, vol: 0.4 }); tone(a, t, 220, 0.1, { type: 'square', vol: 0.06, slideTo: 90 }); break;
      case 'special':
        tone(a, t, 300, 0.25, { type: 'sawtooth', vol: 0.07, slideTo: 1200 });
        noise(a, t + 0.22, 0.2, { freq: 600, vol: 0.45 });
        break;
      case 'guard': tone(a, t, 520, 0.18, { type: 'triangle', vol: 0.12 }); tone(a, t, 780, 0.18, { type: 'triangle', vol: 0.08 }); break;
      case 'win': [C5, E5, G5, C6, G5, C6].forEach((f, i) => tone(a, t + i * 0.11, f, i === 5 ? 0.6 : 0.18, { type: 'triangle', vol: 0.15 })); break;
      case 'lose': [G5, F5, D5, C5].forEach((f, i) => tone(a, t + i * 0.16, f / 2, 0.25, { type: 'triangle', vol: 0.14 })); break;
      case 'munch': [0, 0.12, 0.24].forEach((d) => noise(a, t + d, 0.07, { freq: 1200, vol: 0.25 })); break;
      case 'squeak': tone(a, t, 1200, 0.12, { type: 'sine', vol: 0.15, slideTo: 1800 }); tone(a, t + 0.15, 1300, 0.12, { type: 'sine', vol: 0.15, slideTo: 1900 }); break;
      case 'bubbles': [0, 0.08, 0.15, 0.24].forEach((d, i) => tone(a, t + d, 500 + i * 180, 0.08, { type: 'sine', vol: 0.12, slideTo: 1100 + i * 200 })); break;
      case 'notes': [C5, E5, G5, A5, G5].forEach((f, i) => tone(a, t + i * 0.13, f, 0.22, { type: 'sine', vol: 0.15 })); break;
      case 'whoosh': noise(a, t, 0.35, { freq: 1200, vol: 0.2, q: 0.6 }); break;
    }
  } catch {}
}
