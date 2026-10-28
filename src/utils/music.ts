/**
 * Música de fondo de MathQuest 5 (ADR-024).
 *
 * Todo se sintetiza con Web Audio (sin archivos), igual que los efectos de audio.ts. Son
 * melodías ORIGINALES de aventura (pentatónicas, alegres y suaves); no copian ninguna obra.
 *
 * Diseño:
 *  - Una pista por lugar: mapa, cada región y el Gran Final del universo completado.
 *  - Volumen muy bajo (bus de música ≈ 0.05) con filtro paso-bajo para que suene "de fondo".
 *  - Cambio de pista con fundido cruzado (~1,2 s).
 *  - "Ducking": cuando suena un efecto (acierto, error...) la música baja un momento.
 *  - No arranca hasta el primer toque/tecla (política de autoplay de los navegadores).
 *  - Se calla sola si la pestaña queda oculta y vuelve al regresar.
 *  - Respeta el botón de silencio global (setMusicMuted) y tiene su propio interruptor
 *    (setMusicEnabled), recordado en localStorage.
 *  - Sin AudioContext (pruebas, navegadores viejos) todo son no-operaciones.
 */

export type MusicTrackId = 'map' | 'bosque' | 'montana' | 'ciudad' | 'castillo' | 'finale';

interface Track {
  /** Nota MIDI de la tónica (melodía). */
  root: number;
  bpm: number;
  /** Tónica de cada compás respecto a `root` (semitonos); 4 compases. */
  chords: number[];
  /** Melodía: 4 compases × 8 corcheas = 32 pasos, en semitonos sobre `root` (null = silencio). */
  melody: (number | null)[];
  /** Calidad de los acordes: mayor o menor. */
  minor?: boolean;
  lead: OscillatorType;
  /** Si es true, el bajo hace "oom-pah" (tónica y quinta); si no, solo tónica en 1 y 3. */
  bounce?: boolean;
}

const N = null;

export const TRACKS: Record<MusicTrackId, Track> = {
  // Mapa: paseo tranquilo y curioso.
  map: {
    root: 60, bpm: 96, chords: [0, 9, 5, 7], lead: 'triangle', bounce: true,
    melody: [
      4, N, 7, N, 9, 7, 4, N,
      4, N, 9, N, 12, 9, 7, N,
      5, N, 9, N, 12, 9, 5, N,
      7, 9, 7, 4, 2, N, 0, N,
    ],
  },
  // Bosque (Suma): saltarín y luminoso.
  bosque: {
    root: 67, bpm: 116, chords: [0, 5, 7, 0], lead: 'square', bounce: true,
    melody: [
      0, 4, 7, 4, 9, 7, 4, 2,
      0, 4, 7, 12, 9, 7, 4, N,
      5, 9, 12, 9, 7, 4, 2, 4,
      7, N, 4, N, 0, 2, 4, N,
    ],
  },
  // Montaña (Resta): aire abierto, notas que bajan como una ladera.
  montana: {
    root: 62, bpm: 100, chords: [0, 7, 9, 5], lead: 'triangle', bounce: false,
    melody: [
      12, N, 9, 7, 9, N, 4, N,
      7, N, 4, 2, 4, N, 0, N,
      9, N, 7, 4, 7, N, 2, N,
      5, 7, 9, 7, 4, N, N, N,
    ],
  },
  // Ciudad (Multiplicación): ritmo marcado, un poco juguetón.
  ciudad: {
    root: 65, bpm: 124, chords: [0, 0, 5, 7], lead: 'square', bounce: true,
    melody: [
      0, N, 4, 4, 7, N, 4, N,
      0, N, 4, 4, 9, N, 7, N,
      5, N, 9, 9, 12, N, 9, N,
      7, 7, 4, 4, 2, N, 0, N,
    ],
  },
  // Castillo (División): señorial pero amable, en modo menor.
  castillo: {
    root: 57, bpm: 92, chords: [0, 8, 5, 7], minor: true, lead: 'triangle', bounce: false,
    melody: [
      0, N, 3, 7, 12, N, 10, N,
      8, N, 7, 3, 7, N, N, N,
      5, N, 8, 12, 10, N, 8, N,
      7, 8, 7, 3, 2, N, 0, N,
    ],
  },
  // Gran Final: triunfal y festivo.
  finale: {
    root: 60, bpm: 132, chords: [0, 5, 9, 7], lead: 'square', bounce: true,
    melody: [
      12, 16, 19, 16, 12, 16, 19, N,
      17, 21, 24, 21, 17, 21, 24, N,
      16, 19, 21, 19, 16, 14, 12, N,
      14, 17, 19, 17, 14, 11, 12, N,
    ],
  },
};

/** Volumen del bus de música (muy bajo a propósito: es fondo). */
export const MUSIC_LEVEL = 0.05;
const DUCK_FACTOR = 0.35;
const FADE_S = 1.2;
const LOOKAHEAD_S = 0.35;
const TICK_MS = 120;
const STORAGE_KEY = 'mq5.music';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

let ctx: AudioContext | null = null;
let master: GainNode | null = null; // volumen general + ducking + silencio
let desired: MusicTrackId | null = null;
let enabled = readPref();
let muted = false;
let hidden = false;
let unlockBound = false;

interface Player {
  id: MusicTrackId;
  bus: GainNode;
  timer: ReturnType<typeof setInterval>;
  nextTime: number;
  step: number;
}
let current: Player | null = null;

function readPref(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writePref(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* sin almacenamiento: se queda solo en memoria */
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(lp);
      lp.connect(ctx.destination);
    } catch {
      ctx = null;
      return null;
    }
  }
  return ctx;
}

function shouldPlay() {
  return enabled && !muted && !hidden;
}

function targetLevel() {
  return shouldPlay() ? MUSIC_LEVEL : 0;
}

function rampMaster(seconds = 0.25) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(targetLevel(), now + seconds);
}

function note(c: AudioContext, bus: GainNode, freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Programa las notas del paso `step` (corchea) de la pista, empezando en el tiempo `t`. */
function scheduleStep(c: AudioContext, bus: GainNode, tr: Track, step: number, t: number) {
  const eighth = 60 / tr.bpm / 2;
  const bar = Math.floor(step / 8) % tr.chords.length;
  const inBar = step % 8;
  const chordRoot = tr.root + tr.chords[bar];

  // Melodía
  const m = tr.melody[step % tr.melody.length];
  if (m !== null && m !== undefined) {
    note(c, bus, mtof(tr.root + m), t, eighth * 1.6, tr.lead, tr.lead === 'square' ? 0.5 : 0.9);
  }

  // Bajo (una octava y media por debajo)
  const bassRoot = chordRoot - 24;
  if (tr.bounce) {
    if (inBar % 4 === 0) note(c, bus, mtof(bassRoot), t, eighth * 1.8, 'triangle', 1);
    if (inBar % 4 === 2) note(c, bus, mtof(bassRoot + 7), t, eighth * 1.2, 'triangle', 0.7);
  } else if (inBar === 0 || inBar === 4) {
    note(c, bus, mtof(bassRoot), t, eighth * 3.5, 'triangle', 1);
  }

  // Acompañamiento suave: tercera y quinta en los tiempos 2 y 4 de cada compás
  if (inBar === 2 || inBar === 6) {
    const third = tr.minor ? 3 : 4;
    note(c, bus, mtof(chordRoot - 12 + third), t, eighth * 1.5, 'sine', 0.45);
    note(c, bus, mtof(chordRoot - 12 + 7), t, eighth * 1.5, 'sine', 0.45);
  }
}

function startPlayer(id: MusicTrackId) {
  const c = getCtx();
  if (!c || !master) return;
  const tr = TRACKS[id];
  const bus = c.createGain();
  bus.gain.setValueAtTime(0.0001, c.currentTime);
  bus.gain.linearRampToValueAtTime(1, c.currentTime + FADE_S);
  bus.connect(master);
  const p: Player = { id, bus, nextTime: c.currentTime + 0.08, step: 0, timer: 0 as unknown as ReturnType<typeof setInterval> };
  const eighth = 60 / tr.bpm / 2;
  p.timer = setInterval(() => {
    const cc = ctx;
    if (!cc) return;
    while (p.nextTime < cc.currentTime + LOOKAHEAD_S) {
      scheduleStep(cc, bus, tr, p.step, p.nextTime);
      p.nextTime += eighth;
      p.step = (p.step + 1) % tr.melody.length;
    }
  }, TICK_MS);
  current = p;
}

function stopPlayer(p: Player, fade = true) {
  clearInterval(p.timer);
  const c = ctx;
  if (c && fade) {
    const now = c.currentTime;
    p.bus.gain.cancelScheduledValues(now);
    p.bus.gain.setValueAtTime(p.bus.gain.value, now);
    p.bus.gain.linearRampToValueAtTime(0.0001, now + FADE_S);
    setTimeout(() => {
      try {
        p.bus.disconnect();
      } catch {
        /* ya desconectado */
      }
    }, FADE_S * 1000 + 200);
  } else {
    try {
      p.bus.disconnect();
    } catch {
      /* ya desconectado */
    }
  }
}

/** Reconcilia lo que debe sonar con lo que suena. */
function sync() {
  if (!desired || !enabled) {
    if (current) {
      stopPlayer(current);
      current = null;
    }
    return;
  }
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    // Sin gesto del usuario todavía: se reintenta en el primer toque/tecla.
    bindUnlock();
    void c.resume().catch(() => undefined);
    if (c.state === 'suspended') return;
  }
  if (hidden) {
    // Pestaña oculta: se detiene el reloj para no acumular notas; el volumen ya está en 0.
    if (current) {
      stopPlayer(current, false);
      current = null;
    }
    rampMaster(0.05);
    return;
  }
  if (!current || current.id !== desired) {
    if (current) stopPlayer(current);
    startPlayer(desired);
  }
  rampMaster();
}

function bindUnlock() {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;
  const handler = () => {
    window.removeEventListener('pointerdown', handler, true);
    window.removeEventListener('keydown', handler, true);
    unlockBound = false;
    sync();
  };
  window.addEventListener('pointerdown', handler, true);
  window.addEventListener('keydown', handler, true);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    hidden = document.visibilityState === 'hidden';
    sync();
  });
}

/** Elige qué pista debe sonar (null = ninguna). Es barato llamarlo en cada render. */
export function setMusicTrack(id: MusicTrackId | null) {
  if (id === desired) return;
  desired = id;
  sync();
}

/** Lo llama el botón de silencio global (audio.ts). */
export function setMusicMuted(value: boolean) {
  muted = value;
  rampMaster();
}

export function isMusicEnabled(): boolean {
  return enabled;
}

/** Interruptor propio de la música (independiente del silencio de efectos). */
export function setMusicEnabled(value: boolean): boolean {
  enabled = value;
  writePref(value);
  sync();
  return enabled;
}

export function toggleMusic(): boolean {
  return setMusicEnabled(!enabled);
}

/** La música baja un momento para que se oiga un efecto de sonido. */
export function duckMusic(seconds = 0.7) {
  if (!ctx || !master || !shouldPlay()) return;
  const now = ctx.currentTime;
  const g = master.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(MUSIC_LEVEL * DUCK_FACTOR, now + 0.06);
  g.setValueAtTime(MUSIC_LEVEL * DUCK_FACTOR, now + seconds);
  g.linearRampToValueAtTime(MUSIC_LEVEL, now + seconds + 0.5);
}

/** Pista que corresponde a lo que se ve en pantalla. */
export function trackFor(opts: { finale: boolean; viewMode: 'map' | 'game'; regionId: string }): MusicTrackId {
  if (opts.finale) return 'finale';
  if (opts.viewMode === 'map') return 'map';
  return opts.regionId in TRACKS && opts.regionId !== 'map' && opts.regionId !== 'finale'
    ? (opts.regionId as MusicTrackId)
    : 'map';
}
