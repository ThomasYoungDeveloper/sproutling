// Renders the game's synthesized sound effects to small WAV files for the phone app.
// Files are 3.5x louder than the live web mix because phone speakers are quieter.
// The web version plays the same recipes live with Web Audio (src/lib/sound.ts).
// Run: node scripts/make-sounds.mjs
import { writeFileSync } from 'node:fs';

const SR = 22050;
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A5 = 880, D5 = 587.33, F5 = 698.46;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function wave(type, ph) {
  const x = ph % 1;
  if (type === 'square') return x < 0.5 ? 1 : -1;
  if (type === 'sawtooth') return 2 * x - 1;
  if (type === 'triangle') return 1 - 4 * Math.abs(x - 0.5);
  return Math.sin(2 * Math.PI * x);
}
// Exponential attack to v in 12 ms, then exponential decay to silence at dur (like the Web Audio envelope).
function env(t, dur, v) {
  const lo = 0.0001, att = 0.012;
  if (t < 0 || t > dur) return 0;
  if (t < att) return lo * Math.pow(v / lo, t / att);
  return v * Math.pow(lo / v, (t - att) / (dur - att));
}

function render(build) {
  const parts = [];
  const api = {
    tone(at, freq, dur, o = {}) { parts.push({ kind: 'tone', at, freq, dur, ...o }); },
    noise(at, dur, o = {}) { parts.push({ kind: 'noise', at, dur, ...o }); },
  };
  build(api);
  const end = Math.max(...parts.map((p) => p.at + p.dur)) + 0.03;
  const out = new Float32Array(Math.ceil(end * SR));
  for (const p of parts) {
    const start = Math.floor(p.at * SR);
    const n = Math.ceil(p.dur * SR);
    if (p.kind === 'tone') {
      const v = (p.vol ?? 0.18) * 0.6;
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = p.slideTo ? p.freq * Math.pow(p.slideTo / p.freq, t / p.dur) : p.freq;
        ph += f / SR;
        out[start + i] += wave(p.type ?? 'sine', ph) * env(t, p.dur, v);
      }
    } else {
      // Band-pass filtered noise that fades out linearly.
      const f0 = p.freq ?? 1800, Q = p.q ?? 1.2;
      const w = (2 * Math.PI * f0) / SR, al = Math.sin(w) / (2 * Q), a0 = 1 + al;
      const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      const g = (p.vol ?? 0.25) * 0.6;
      for (let i = 0; i < n; i++) {
        const x = (rand() * 2 - 1) * (1 - i / n);
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        out[start + i] += y * g;
      }
    }
  }
  return out;
}

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(s * 3.5 * 32767))), 44 + i * 2));
  return buf;
}

const R = {
  tap: ({ tone }) => tone(0, 880, 0.06, { type: 'triangle', vol: 0.1 }),
  pop: ({ tone }) => tone(0, 420, 0.09, { vol: 0.18, slideTo: 900 }),
  thud: ({ tone }) => tone(0, 160, 0.14, { vol: 0.25, slideTo: 70 }),
  chime: ({ tone }) => [C5, E5, G5].forEach((f, i) => tone(i * 0.06, f, 0.22, { type: 'triangle', vol: 0.14 })),
  coin: ({ tone }) => { tone(0, 988, 0.07, { type: 'square', vol: 0.07 }); tone(0.07, 1319, 0.18, { type: 'square', vol: 0.07 }); },
  crack: ({ tone, noise }) => { noise(0, 0.08, { freq: 2500, vol: 0.3 }); tone(0, 300, 0.05, { type: 'square', vol: 0.05 }); },
  hatch: ({ tone, noise }) => {
    noise(0, 0.12, { freq: 3000, vol: 0.3 });
    [C5, E5, G5, C6].forEach((f, i) => tone(0.12 + i * 0.09, f, 0.3, { type: 'triangle', vol: 0.15 }));
    tone(0.5, C6, 0.6, { vol: 0.12 });
  },
  chest: ({ tone, noise }) => { noise(0, 0.15, { freq: 900, vol: 0.25 }); [G5, C6, E5 * 2].forEach((f, i) => tone(0.12 + i * 0.07, f, 0.25, { type: 'triangle', vol: 0.12 })); },
  levelup: ({ tone }) => [C5, E5, G5, C6, G5, C6].forEach((f, i) => tone(i * 0.08, f, 0.2, { type: 'square', vol: 0.06 })),
  hit: ({ tone, noise }) => { noise(0, 0.1, { freq: 700, vol: 0.4 }); tone(0, 220, 0.1, { type: 'square', vol: 0.06, slideTo: 90 }); },
  special: ({ tone, noise }) => { tone(0, 300, 0.25, { type: 'sawtooth', vol: 0.07, slideTo: 1200 }); noise(0.22, 0.2, { freq: 600, vol: 0.45 }); },
  guard: ({ tone }) => { tone(0, 520, 0.18, { type: 'triangle', vol: 0.12 }); tone(0, 780, 0.18, { type: 'triangle', vol: 0.08 }); },
  win: ({ tone }) => [C5, E5, G5, C6, G5, C6].forEach((f, i) => tone(i * 0.11, f, i === 5 ? 0.6 : 0.18, { type: 'triangle', vol: 0.15 })),
  lose: ({ tone }) => [G5, F5, D5, C5].forEach((f, i) => tone(i * 0.16, f / 2, 0.25, { type: 'triangle', vol: 0.14 })),
  munch: ({ noise }) => [0, 0.12, 0.24].forEach((d) => noise(d, 0.07, { freq: 1200, vol: 0.25 })),
  squeak: ({ tone }) => { tone(0, 1200, 0.12, { vol: 0.15, slideTo: 1800 }); tone(0.15, 1300, 0.12, { vol: 0.15, slideTo: 1900 }); },
  bubbles: ({ tone }) => [0, 0.08, 0.15, 0.24].forEach((d, i) => tone(d, 500 + i * 180, 0.08, { vol: 0.12, slideTo: 1100 + i * 200 })),
  notes: ({ tone }) => [C5, E5, G5, A5, G5].forEach((f, i) => tone(i * 0.13, f, 0.22, { vol: 0.15 })),
  whoosh: ({ noise }) => noise(0, 0.35, { freq: 1200, vol: 0.2, q: 0.6 }),
};

let lines = ["// Generated by scripts/make-sounds.mjs. Do not edit by hand.", 'export const SOUND_FILES = {'];
for (const [name, build] of Object.entries(R)) {
  writeFileSync(`assets/sounds/${name}.wav`, wav(render(build)));
  lines.push(`  ${name}: require('../../assets/sounds/${name}.wav'),`);
}
lines.push('} as const;', '');
writeFileSync('src/lib/soundFiles.ts', lines.join('\n'));
console.log('wrote', Object.keys(R).length, 'sounds');
