import { RegionDefinition, GameModeInfo } from '../types';

/**
 * Las 4 regiones (una por operación), igual que en `supabase/migrations/0002...sql`.
 * Solo metadatos visuales: el contenido real (preguntas, dificultad, XP) vive en
 * Supabase y se lee en `src/lib/game.ts` (ver ADR-003/006/007 en docs/DECISIONS.md).
 */
export const REGIONS: RegionDefinition[] = [
  {
    id: 'bosque',
    name: 'Bosque de la Suma',
    shortName: 'Bosque',
    operation: 'add',
    themeColor: '#3FA34D',
    accentColor: '#5FCB6D',
    bgGradient: 'from-emerald-900/60 to-emerald-950/90',
    icon: '🌳',
    competency: 'Sumas de 1 cifra',
    description: 'Recorre el bosque resolviendo sumas de 1 cifra a través de los 5 desafíos.',
    islandPosition: [-9.5, 0.6, 4.5],
  },
  {
    id: 'montana',
    name: 'Montaña de la Resta',
    shortName: 'Montaña',
    operation: 'sub',
    themeColor: '#D9A441',
    accentColor: '#F2B705',
    bgGradient: 'from-amber-900/60 to-amber-950/90',
    icon: '⛰️',
    competency: 'Restas de 1 cifra',
    description: 'Sube la montaña resolviendo restas de 1 cifra a través de los 5 desafíos.',
    islandPosition: [-4.0, 2.5, -4.5],
  },
  {
    id: 'ciudad',
    name: 'Ciudad de la Multiplicación',
    shortName: 'Ciudad',
    operation: 'mul',
    themeColor: '#8B5CF6',
    accentColor: '#A78BFA',
    bgGradient: 'from-purple-900/60 to-purple-950/90',
    icon: '🏙️',
    competency: 'Multiplicaciones de 1 cifra',
    description: 'Explora la ciudad resolviendo multiplicaciones a través de los 5 desafíos.',
    islandPosition: [4.2, 1.2, -6.0],
  },
  {
    id: 'castillo',
    name: 'Castillo de la División',
    shortName: 'Castillo',
    operation: 'div',
    themeColor: '#EC4899',
    accentColor: '#F472B6',
    bgGradient: 'from-pink-900/60 to-slate-950/90',
    icon: '🏰',
    competency: 'Divisiones: de las tablas hasta 4 cifras',
    description: 'Conquista el castillo resolviendo divisiones a través de los 5 desafíos.',
    islandPosition: [2.5, 4.2, 6.8],
  },
];

/**
 * Los 5 niveles, en el mismo orden fijo dentro de cada región (ver ADR-006).
 * sortOrder/tiempo/vidas/dificultad reales se leen de `game_modes` en Supabase;
 * esto es solo para pintar el ícono y el nombre antes de que respondan los datos.
 */
export const GAME_MODES: GameModeInfo[] = [
  { id: 'race', name: 'Carrera Matemática', subtitle: 'Responde rápido para avanzar por la pista.', icon: '🏃', sortOrder: 1 },
  { id: 'battle', name: 'Batalla Matemática', subtitle: 'Cada acierto es un ataque al enemigo.', icon: '⚔️', sortOrder: 2 },
  { id: 'bridge', name: 'Construye el Puente', subtitle: 'Cada acierto coloca un bloque del puente.', icon: '🌉', sortOrder: 3 },
  { id: 'shop', name: 'Tienda Matemática', subtitle: 'Resuelve las cuentas de las compras.', icon: '🛒', sortOrder: 4 },
  { id: 'detective', name: 'Detective Matemático', subtitle: 'Descubre el número secreto que falta.', icon: '🕵️', sortOrder: 5 },
];

export function findRegion(regionId: string): RegionDefinition {
  return REGIONS.find((r) => r.id === regionId) || REGIONS[0];
}

export function findGameMode(gameModeId: string): GameModeInfo {
  return GAME_MODES.find((g) => g.id === gameModeId) || GAME_MODES[0];
}
