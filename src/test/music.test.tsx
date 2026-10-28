import { describe, it, expect } from 'vitest';
import { TRACKS, trackFor, MUSIC_LEVEL, setMusicTrack, toggleMusic, isMusicEnabled, duckMusic } from '../utils/music';

describe('música de fondo', () => {
  it('cada pista tiene 4 compases de 8 corcheas y un acorde por compás', () => {
    for (const [id, t] of Object.entries(TRACKS)) {
      expect(t.melody.length, id).toBe(32);
      expect(t.chords.length, id).toBe(4);
      expect(t.bpm).toBeGreaterThan(50);
      expect(t.bpm).toBeLessThan(80);
    }
  });

  it('las 6 pistas son distintas entre sí', () => {
    const sigs = Object.values(TRACKS).map((t) => JSON.stringify(t.melody));
    expect(new Set(sigs).size).toBe(6);
  });

  it('elige la pista según lo que se ve', () => {
    expect(trackFor({ finale: true, viewMode: 'game', regionId: 'bosque' })).toBe('finale');
    expect(trackFor({ finale: false, viewMode: 'map', regionId: 'ciudad' })).toBe('map');
    expect(trackFor({ finale: false, viewMode: 'game', regionId: 'montana' })).toBe('montana');
    expect(trackFor({ finale: false, viewMode: 'game', regionId: 'castillo' })).toBe('castillo');
    expect(trackFor({ finale: false, viewMode: 'game', regionId: 'raro' })).toBe('map');
  });

  it('es muy suave y no falla sin AudioContext (jsdom)', () => {
    expect(MUSIC_LEVEL).toBeLessThanOrEqual(0.08);
    expect(() => {
      setMusicTrack('bosque');
      duckMusic();
      setMusicTrack(null);
    }).not.toThrow();
  });

  it('el interruptor propio alterna y se recuerda', () => {
    const before = isMusicEnabled();
    expect(toggleMusic()).toBe(!before);
    expect(window.localStorage.getItem('mq5.music')).toBe(before ? 'off' : 'on');
    expect(toggleMusic()).toBe(before);
  });
});
