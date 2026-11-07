/**
 * Música de fondo de MathQuest 5 (ADR-024).
 *
 * Todo se sintetiza con Web Audio (sin archivos), igual que los efectos de audio.ts. Son
 * melodías ORIGINALES de aventura (pentatónicas, alegres y suaves); no copian ninguna obra.
 *
 * Diseño:
 *  - Una pista por lugar: mapa, cada región y el Gran Final del universo completado.
 *  - Volumen muy bajo (bus de música ≈ 0.05) con filtro paso-bajo para que suene "de fondo".
 *  - Cambio de pista con fundido cruzado (~2 s).
 *  - "Ducking": cuando suena un efecto (acierto, error...) la música baja un momento.
 *  - No arranca hasta el primer toque/tecla (política de autoplay de los navegadores).
 *  - Se calla sola si la pestaña queda oculta y vuelve al regresar.
 *  - Respeta el botón de silencio global (setMusicMuted) y tiene su propio interruptor
 *    (setMusicEnabled), recordado en localStorage.
 *  - Sin AudioContext (pruebas, navegadores viejos) todo son no-operaciones.
 */

export type MusicTrackId = 'map' | 'bosque' | 'montana' | 'ciudad' | 'castillo' | 'finale';

/** "Instrumento" de la melodía: cada mundo suena con uno distinto. */
export type Voice = 'kalimba' | 'marimba' | 'flute' | 'epiano' | 'organ' | 'bell';
/** Forma del acompañamiento: cada mundo se mueve de una manera distinta. */
type Style = 'offbeat' | 'arp' | 'drone' | 'walk' | 'pad' | 'bounce';

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
  voice: Voice;
  style: Style;
  /** Retraso de las corcheas impares (fracción de corchea): da balanceo tipo "swing". */
  swing?: number;
}

const N = null;

export const TRACKS: Record<MusicTrackId, Track> = {
  // Mapa / respaldo: kalimba curiosa, paseo tranquilo.
  map: {
    root: 60, bpm: 62, chords: [0, 9, 5, 7], voice: 'kalimba', style: 'offbeat',
    melody: [
      4, N, 7, N, 9, 7, 4, N,
      4, N, 9, N, 12, 9, 7, N,
      5, N, 9, N, 12, 9, 5, N,
      7, 9, 7, 4, 2, N, 0, N,
    ],
  },
  // Bosque (Suma): marimba alegre con arpegios que saltan, como hojas al viento.
  bosque: {
    root: 67, bpm: 76, chords: [0, 5, 7, 0], voice: 'marimba', style: 'arp',
    melody: [
      0, N, 4, 7, N, 9, 7, N,
      12, N, 9, 7, N, 4, 2, N,
      5, N, 9, 12, N, 9, 7, N,
      4, 7, 4, 2, 0, N, N, N,
    ],
  },
  // Montaña (Resta): flauta abierta y muy tranquila sobre un bordón, notas que bajan por la ladera.
  montana: {
    root: 62, bpm: 50, chords: [0, 0, 7, 5], voice: 'flute', style: 'drone',
    melody: [
      12, N, N, N, 9, N, N, N,
      7, N, N, 9, 7, N, 4, N,
      9, N, N, N, 7, N, N, N,
      4, N, 2, N, 0, N, N, N,
    ],
  },
  // Ciudad (Multiplicación): piano eléctrico con balanceo y bajo que camina.
  ciudad: {
    root: 65, bpm: 84, chords: [0, 0, 5, 7], voice: 'epiano', style: 'walk', swing: 0.25,
    melody: [
      N, 4, 7, N, 9, 7, N, 4,
      N, 4, 7, N, 12, 9, N, 7,
      N, 5, 9, N, 12, 9, N, 5,
      7, N, 4, 2, 4, N, 0, N,
    ],
  },
  // Castillo (División): órgano señorial en menor, acordes largos y melodía lenta.
  castillo: {
    root: 57, bpm: 46, chords: [0, 8, 5, 7], minor: true, voice: 'organ', style: 'pad',
    melody: [
      12, N, N, N, 10, N, N, N,
      8, N, N, N, 7, N, N, N,
      8, N, N, N, 12, N, N, N,
      10, N, 8, N, 7, N, N, N,
    ],
  },
  // Gran Final: campanas brillantes y festivas.
  finale: {
    root: 60, bpm: 80, chords: [0, 5, 9, 7], voice: 'bell', style: 'bounce',
    melody: [
      12, 16, 19, 16, 12, 16, 19, N,
      17, 21, 24, 21, 17, 21, 24, N,
      16, 19, 21, 19, 16, 14, 12, N,
      14, 17, 19, 17, 14, 11, 12, N,
    ],
  },
};

/** Volumen del bus de música (muy bajo y cálido a propósito: es fondo). */
export const MUSIC_LEVEL = 0.05;
const DUCK_FACTOR = 0.4;
const FADE_S = 2;
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
      lp.frequency.value = 1500;
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(lp);
      lp.connect(ctx.destination);
      // Eco suave: da calidez y "aire" sin añadir notas.
      const echo = ctx.createDelay(1);
      echo.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      lp.connect(echo);
      echo.connect(fb);
      fb.connect(echo);
      echo.connect(wet);
      wet.connect(ctx.destination);
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

function note(c: AudioContext, bus: GainNode, freq: number, t: number, dur: number, type: OscillatorType, vol: number, attack?: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + (attack ?? Math.min(0.09, dur * 0.3)));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Flauta: senoidal con soplo suave y un vibrato leve que aparece al sostener la nota. */
function fluteNote(c: AudioContext, bus: GainNode, freq: number, t: number, dur: number, vol: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lg = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  lfo.frequency.value = 4.8;
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(9, t + dur * 0.7); // cents
  lfo.connect(lg);
  lg.connect(osc.detune);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.16);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + dur + 0.02);
  lfo.stop(t + dur + 0.02);
}

/** Una nota con el "instrumento" del mundo. `e` = duración de una corchea. */
function voiceNote(c: AudioContext, bus: GainNode, voice: Voice, freq: number, t: number, e: number, vol = 1) {
  switch (voice) {
    case 'marimba':
      note(c, bus, freq, t, e * 1.8, 'triangle', 0.9 * vol, 0.006);
      note(c, bus, freq * 4, t, e * 0.6, 'sine', 0.14 * vol, 0.004);
      break;
    case 'kalimba':
      note(c, bus, freq, t, e * 2.6, 'sine', 0.85 * vol, 0.004);
      note(c, bus, freq * 3, t, e * 0.8, 'sine', 0.12 * vol, 0.003);
      break;
    case 'epiano':
      note(c, bus, freq, t, e * 2.4, 'sine', 0.8 * vol, 0.01);
      note(c, bus, freq * 2, t, e * 1.2, 'sine', 0.25 * vol, 0.01);
      break;
    case 'organ':
      note(c, bus, freq, t, e * 4.5, 'sine', 0.7 * vol, 0.18);
      note(c, bus, freq * 2, t, e * 4.5, 'sine', 0.25 * vol, 0.2);
      note(c, bus, freq * 3, t, e * 4, 'sine', 0.08 * vol, 0.2);
      break;
    case 'bell':
      note(c, bus, freq, t, e * 3.5, 'sine', 0.8 * vol, 0.004);
      note(c, bus, freq * 2.76, t, e * 1.6, 'sine', 0.12 * vol, 0.003);
      break;
    case 'flute':
      fluteNote(c, bus, freq, t, e * 5, 0.85 * vol);
      break;
  }
}

/** Programa las notas del paso `step` (corchea) de la pista, empezando en el tiempo `t`. */
function scheduleStep(c: AudioContext, bus: GainNode, tr: Track, step: number, t0: number) {
  const e = 60 / tr.bpm / 2;
  const bar = Math.floor(step / 8) % tr.chords.length;
  const inBar = step % 8;
  const chordRoot = tr.root + tr.chords[bar];
  const third = tr.minor ? 3 : 4;
  const bassRoot = chordRoot - 24;
  // Balanceo: las corcheas impares se retrasan un poco
  const t = t0 + (inBar % 2 === 1 && tr.swing ? e * tr.swing : 0);

  // Melodía
  const m = tr.melody[step % tr.melody.length];
  if (m !== null && m !== undefined) voiceNote(c, bus, tr.voice, mtof(tr.root + m), t, e);

  // Acompañamiento, distinto en cada mundo
  switch (tr.style) {
    case 'offbeat': // bajo en 1 y 3; tercera y quinta suaves después
      if (inBar === 0 || inBar === 4) note(c, bus, mtof(bassRoot), t, e * 3.5, 'triangle', 1);
      if (inBar === 2 || inBar === 6) {
        note(c, bus, mtof(chordRoot - 12 + third), t, e * 3, 'sine', 0.4);
        note(c, bus, mtof(chordRoot - 12 + 7), t, e * 3, 'sine', 0.4);
      }
      break;
    case 'arp': { // arpegio suave del acorde, una nota por corchea
      if (inBar === 0 || inBar === 4) note(c, bus, mtof(bassRoot), t, e * 3.5, 'triangle', 0.9);
      const tones = [0, third, 7, 12, 7, third, 0, third];
      voiceNote(c, bus, 'marimba', mtof(chordRoot - 12 + tones[inBar]), t, e, 0.3);
      break;
    }
    case 'drone': // bordón largo de tónica y quinta
      if (inBar === 0) {
        note(c, bus, mtof(bassRoot), t, e * 8, 'sine', 0.9, 0.5);
        note(c, bus, mtof(bassRoot + 7), t, e * 8, 'sine', 0.45, 0.6);
      }
      break;
    case 'walk': { // bajo que camina en negras + acorde corto a contratiempo
      if (inBar % 2 === 0) {
        const walk = [0, third, 7, third];
        note(c, bus, mtof(bassRoot + walk[(inBar / 2) | 0]), t, e * 1.8, 'triangle', 0.85);
      }
      if (inBar === 3 || inBar === 7) voiceNote(c, bus, 'epiano', mtof(chordRoot - 12 + third), t, e, 0.3);
      break;
    }
    case 'pad': // acordes largos que se funden
      if (inBar === 0 || inBar === 4) {
        voiceNote(c, bus, 'organ', mtof(chordRoot - 12), t, e, 0.32);
        voiceNote(c, bus, 'organ', mtof(chordRoot - 12 + third), t, e, 0.25);
        voiceNote(c, bus, 'organ', mtof(chordRoot - 12 + 7), t, e, 0.25);
      }
      break;
    case 'bounce': // bajo saltarín y destellos de campana
      if (inBar % 4 === 0) note(c, bus, mtof(bassRoot), t, e * 3.5, 'triangle', 0.9);
      if (inBar % 4 === 2) note(c, bus, mtof(bassRoot + 7), t, e * 2.4, 'triangle', 0.55);
      if (inBar % 2 === 1) voiceNote(c, bus, 'bell', mtof(chordRoot + 12 + [0, third, 7][((inBar / 2) | 0) % 3]), t, e, 0.18);
      break;
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

/**
 * Pista que corresponde a lo que se ve en pantalla: cada mundo tiene SU canción, tanto en el
 * mapa como jugando (así no suena igual para todos); el Gran Final tiene la suya.
 * `map` queda solo de respaldo si la región no se reconoce.
 */
export function trackFor(opts: { finale: boolean; viewMode: 'map' | 'game'; regionId: string }): MusicTrackId {
  if (opts.finale) return 'finale';
  return opts.regionId in TRACKS && opts.regionId !== 'map' && opts.regionId !== 'finale'
    ? (opts.regionId as MusicTrackId)
    : 'map';
}
