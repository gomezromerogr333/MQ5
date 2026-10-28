import { supabase } from './supabase';
import type { GameMode, MathQuestion, RegionProgress, RoundAnswer } from '../types';

/**
 * Mezcla uniforme (Fisher-Yates). Antes era `sort(() => Math.random() - 0.5)`, que
 * NO es uniforme: medido con 300.000 mezclas, la respuesta correcta caía en la
 * posición A el 44 % de las veces, en B el 19 % y en C el 38 %, y algunas preguntas
 * salían hasta 2,5 veces más que otras.
 */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Tope de filas que se piden por nivel. Antes 200: la Resta (niveles 4 y 5) tiene
// 279 y 270 preguntas y las sobrantes casi nunca salían. El banco más grande hoy
// es 279; PostgREST corta en 1000 por defecto, así que 500 deja margen sin riesgo.
const QUESTION_POOL_LIMIT = 500;

function questionKindLabel(kind: string): string {
  if (kind === 'missing_first') return 'Falta el primer número';
  if (kind === 'missing_second') return 'Falta el segundo número';
  return 'Cálculo directo';
}

interface ProgressRow {
  region_id: string;
  region_sort: number;
  region_required_xp: number;
  region_unlocked: boolean;
  game_mode_id: GameMode;
  level_sort: number;
  level_unlocked: boolean;
  best_stars: number;
  rounds_played: number;
}

/** Progreso completo (4 regiones × 5 niveles) desde get_my_progress() + XP total. */
export async function fetchProgress(): Promise<{ regions: RegionProgress[]; totalXp: number }> {
  // Calienta en paralelo la configuración de los niveles (se cachea): así el primer nivel que
  // elija el niño ya no espera esas consultas. Si falla, fetchQuestionsForLevel reintenta.
  void Promise.all([loadGameModes(), loadRegionGameOverrides()]).catch(() => undefined);
  const [progressRes, xpRes] = await Promise.all([
    supabase.rpc('get_my_progress'),
    supabase.rpc('get_my_total_xp'),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (xpRes.error) throw xpRes.error;

  const byRegion = new Map<string, RegionProgress>();
  for (const row of (progressRes.data ?? []) as ProgressRow[]) {
    let region = byRegion.get(row.region_id);
    if (!region) {
      region = {
        regionId: row.region_id,
        sortOrder: row.region_sort,
        requiredXp: row.region_required_xp,
        unlocked: row.region_unlocked,
        levels: [],
      };
      byRegion.set(row.region_id, region);
    }
    region.levels.push({
      gameModeId: row.game_mode_id,
      sortOrder: row.level_sort,
      unlocked: row.level_unlocked,
      bestStars: row.best_stars,
      roundsPlayed: row.rounds_played,
    });
  }

  const regions = [...byRegion.values()]
    .map((r) => ({ ...r, levels: r.levels.sort((a, b) => a.sortOrder - b.sortOrder) }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { regions, totalXp: (xpRes.data as number) ?? 0 };
}

export interface LevelConfig {
  questionsPerRound: number;
  secondsPerQuestion: number;
  lives: number;
}

interface GameModeRow {
  id: GameMode;
  question_kinds: string[];
  questions_per_round: number;
  seconds_per_question: number;
  lives: number;
  difficulty_min: number;
  difficulty_max: number;
}

// `game_modes` son 5 filas de configuración fija (tiempo, vidas, dificultad
// por modo) sembradas por migración -- no cambian en vivo durante una
// sesión de juego. Antes se volvían a pedir a Supabase en CADA inicio de
// nivel, sumando un viaje de red completo antes de siquiera poder pedir las
// preguntas (ver queja "sigue demorando un poco en cargar"). Cacheamos el
// resultado en memoria del módulo: se pide una sola vez por sesión del
// navegador y desde el segundo nivel en adelante el inicio de nivel solo
// necesita UNA consulta (la de `questions`) en vez de dos en serie.
let gameModesCache: Map<GameMode, GameModeRow> | null = null;
let gameModesPromise: Promise<Map<GameMode, GameModeRow>> | null = null;

// Migración 0012: `region_games` puede traer, para una región + juego concreto,
// un rango de dificultad y un tiempo propios (hoy solo las divisiones largas del
// Castillo). Se cargan junto a `game_modes`, en paralelo, y también se cachean.
// Si la 0012 todavía no está aplicada en Supabase (las columnas no existen) o la
// consulta falla, se ignoran los overrides y todo se comporta como antes.
interface RegionGameOverride {
  difficulty_min: number | null;
  difficulty_max: number | null;
  seconds_per_question: number | null;
}
let overridesCache: Map<string, RegionGameOverride> | null = null;

async function loadRegionGameOverrides(): Promise<Map<string, RegionGameOverride>> {
  if (overridesCache) return overridesCache;
  const map = new Map<string, RegionGameOverride>();
  try {
    const { data, error } = await supabase
      .from('region_games')
      .select('region_id, game_mode_id, difficulty_min, difficulty_max, seconds_per_question');
    if (error) return map; // sin 0012: no se cachea, se reintenta en el próximo nivel
    for (const row of (data ?? []) as Array<RegionGameOverride & { region_id: string; game_mode_id: string }>) {
      if (row.difficulty_min != null || row.seconds_per_question != null) {
        map.set(`${row.region_id}:${row.game_mode_id}`, row);
      }
    }
    overridesCache = map;
  } catch {
    // red caída: mismo criterio, se usa el comportamiento por defecto
  }
  return map;
}

async function loadGameModes(): Promise<Map<GameMode, GameModeRow>> {
  if (gameModesCache) return gameModesCache;
  if (!gameModesPromise) {
    gameModesPromise = (async () => {
      const { data, error } = await supabase
        .from('game_modes')
        .select('id, question_kinds, questions_per_round, seconds_per_question, lives, difficulty_min, difficulty_max');
      if (error) {
        gameModesPromise = null; // permite reintentar en el próximo nivel si falló por red
        throw error;
      }
      const map = new Map<GameMode, GameModeRow>();
      for (const row of (data ?? []) as GameModeRow[]) {
        map.set(row.id, row);
      }
      gameModesCache = map;
      return map;
    })();
  }
  return gameModesPromise;
}

interface QuestionRow {
  id: number;
  kind: string;
  prompt: string;
  correct_answer: number;
  distractors: number[];
  difficulty: number;
  explanation: string;
}

/**
 * Trae las preguntas para jugar un nivel (región + modo): lee la configuración real
 * del nivel desde `game_modes` y saca una muestra aleatoria del banco de `questions`
 * que respeta el `kind` y el rango de dificultad de ese nivel (ver ADR-004/006).
 */
export async function fetchQuestionsForLevel(
  regionId: string,
  gameModeId: GameMode,
): Promise<{ questions: MathQuestion[]; config: LevelConfig }> {
  const [gameModes, overrides] = await Promise.all([loadGameModes(), loadRegionGameOverrides()]);
  const gm = gameModes.get(gameModeId);
  if (!gm) throw new Error(`No encontramos la configuración del modo de juego "${gameModeId}".`);

  const override = overrides.get(`${regionId}:${gameModeId}`);
  const difficultyMin = override?.difficulty_min ?? gm.difficulty_min;
  const difficultyMax = override?.difficulty_max ?? gm.difficulty_max;
  const secondsPerQuestion = override?.seconds_per_question ?? gm.seconds_per_question;

  const { data: rows, error: questionsError } = await supabase
    .from('questions')
    .select('id, kind, prompt, correct_answer, distractors, difficulty, explanation')
    .eq('region_id', regionId)
    .eq('is_active', true)
    .in('kind', gm.question_kinds)
    .gte('difficulty', difficultyMin)
    .lte('difficulty', difficultyMax)
    .limit(QUESTION_POOL_LIMIT);
  if (questionsError) throw questionsError;

  const pool = shuffle((rows ?? []) as QuestionRow[]).slice(0, gm.questions_per_round);
  const questions: MathQuestion[] = pool.map((q) => ({
    id: q.id,
    text: q.prompt,
    category: questionKindLabel(q.kind),
    difficulty: q.difficulty,
    options: shuffle([q.correct_answer, ...q.distractors.slice(0, 2)]),
    correct: q.correct_answer,
    explanation: q.explanation,
  }));

  return {
    questions,
    config: {
      questionsPerRound: gm.questions_per_round,
      secondsPerQuestion,
      lives: gm.lives,
    },
  };
}

export interface SubmitRoundResult {
  stars: number;
  xp_earned: number;
  correct_count: number;
  questions_total: number;
  completed: boolean;
}

/**
 * Envía la ronda jugada. El servidor recalcula aciertos, estrellas y XP desde
 * `questions.correct_answer`: el cliente nunca declara si acertó (ver ADR-004/007).
 */
export async function submitRound(
  regionId: string,
  gameModeId: GameMode,
  answers: RoundAnswer[],
): Promise<SubmitRoundResult> {
  const { data, error } = await supabase.rpc('submit_round', {
    p_region_id: regionId,
    p_game_mode_id: gameModeId,
    p_answers: answers,
  });
  if (error) throw error;
  return data as SubmitRoundResult;
}
