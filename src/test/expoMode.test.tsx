import { describe, it, expect, beforeEach, vi } from 'vitest';

const rows = [
  { region_id: 'bosque', region_sort: 1, region_required_xp: 0, region_unlocked: true, game_mode_id: 'race', level_sort: 1, level_unlocked: true, best_stars: 0, rounds_played: 0 },
  { region_id: 'bosque', region_sort: 1, region_required_xp: 0, region_unlocked: true, game_mode_id: 'battle', level_sort: 2, level_unlocked: false, best_stars: 0, rounds_played: 0 },
  { region_id: 'montana', region_sort: 2, region_required_xp: 0, region_unlocked: false, game_mode_id: 'race', level_sort: 1, level_unlocked: false, best_stars: 0, rounds_played: 0 },
];

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (name: string) => Promise.resolve({ data: name === 'get_my_progress' ? rows : 0, error: null }),
    from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
  },
}));

describe('modo exposición', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it('sin el parámetro todo sigue bloqueado como siempre', async () => {
    const { syncExpoFromUrl } = await import('../lib/expoMode');
    syncExpoFromUrl('');
    const { fetchProgress } = await import('../lib/game');
    const { regions } = await fetchProgress();
    expect(regions[0].levels.map((l) => l.unlocked)).toEqual([true, false]);
    expect(regions[1].unlocked).toBe(false);
  });

  it('?expo=1 abre todos los mundos y niveles y se recuerda', async () => {
    const { syncExpoFromUrl, isExpoMode } = await import('../lib/expoMode');
    syncExpoFromUrl('?expo=1');
    expect(isExpoMode()).toBe(true);
    const { fetchProgress } = await import('../lib/game');
    const { regions } = await fetchProgress();
    expect(regions.every((r) => r.unlocked && r.levels.every((l) => l.unlocked))).toBe(true);
    // el progreso real (estrellas, rondas) no se toca
    expect(regions[0].levels[0].bestStars).toBe(0);
    // recordado tras navegar a otra ruta (sin parámetro)
    syncExpoFromUrl('');
    expect(isExpoMode()).toBe(true);
  });

  it('?expo=0 lo apaga', async () => {
    const { syncExpoFromUrl, isExpoMode } = await import('../lib/expoMode');
    syncExpoFromUrl('?expo=1');
    syncExpoFromUrl('?expo=0');
    expect(isExpoMode()).toBe(false);
  });
});
