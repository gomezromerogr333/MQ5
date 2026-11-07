import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegionLevelStrip } from '../components/RegionLevelStrip';
import { REGIONS } from '../data/regionsData';
import type { RegionProgress } from '../types';

const progress: RegionProgress[] = REGIONS.map((r) => ({
  regionId: r.id,
  unlocked: true,
  levels: ['race', 'battle', 'bridge', 'shop', 'detective'].map((m, i) => ({
    gameModeId: m, unlocked: true, bestStars: 0, roundsPlayed: 0, sortOrder: i + 1,
  })),
})) as unknown as RegionProgress[];

const renderStrip = (regionId: string) => (
  <RegionLevelStrip regions={REGIONS} progress={progress} totalXp={0} currentRegionId={regionId} currentGameModeId="race" onSelectLevel={() => {}} />
);

describe('RegionLevelStrip', () => {
  it('sigue a la región activa cuando cambia desde fuera (isla del mapa)', () => {
    const { rerender } = render(renderStrip('bosque'));
    expect(screen.getByText(/Bosque de la Suma — los 5 desafíos/)).toBeTruthy();
    rerender(renderStrip('castillo'));
    expect(screen.getByText(/Castillo de la División — los 5 desafíos/)).toBeTruthy();
  });
});
