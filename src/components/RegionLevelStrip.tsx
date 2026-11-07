import React, { useEffect, useState } from 'react';
import { GAME_MODES } from '../data/regionsData';
import { GameMode, RegionDefinition, RegionProgress } from '../types';
import { Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { previousRegionOf } from '../lib/unlocks';

interface RegionLevelStripProps {
  regions: RegionDefinition[];
  progress: RegionProgress[];
  totalXp: number;
  currentRegionId: string;
  currentGameModeId: GameMode;
  onSelectLevel: (regionId: string, gameModeId: GameMode) => void;
}

export const RegionLevelStrip: React.FC<RegionLevelStripProps> = ({
  regions,
  progress,
  totalXp,
  currentRegionId,
  currentGameModeId,
  onSelectLevel,
}) => {
  // Qué región se está viendo en la tira de niveles (no siempre la que se está jugando)
  const [viewingRegionId, setViewingRegionId] = useState(currentRegionId);
  // Si la región activa cambia desde fuera (p. ej. tocando una isla del mapa 3D), la tira la sigue;
  // antes se quedaba mostrando la región anterior y el nivel "Jugando" no se veía resaltado.
  useEffect(() => {
    setViewingRegionId(currentRegionId);
  }, [currentRegionId]);
  const viewingRegion = regions.find((r) => r.id === viewingRegionId) || regions[0];
  const viewingProgress = progress.find((p) => p.regionId === viewingRegionId);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Selector de región */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white font-['Baloo_2'] flex items-center gap-2">
              <span>🗺️ Las 4 Regiones Matemáticas</span>
            </h3>
            <p className="text-xs text-slate-400">Cada región tiene los mismos 5 desafíos, con otra operación.</p>
          </div>
          <div className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
            Total XP: {totalXp}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {regions.map((region, index) => {
            const regionProgress = progress.find((p) => p.regionId === region.id);
            // Qué isla hay que terminar para abrir esta (desde la migración 0011 el XP ya no abre islas).
            const prevRegion = previousRegionOf(regions, index);
            const isUnlocked = regionProgress?.unlocked ?? region.id === regions[0].id;
            const isViewing = region.id === viewingRegionId;
            const isPlaying = region.id === currentRegionId;
            const starsTotal = regionProgress?.levels.reduce((sum, l) => sum + l.bestStars, 0) ?? 0;

            return (
              <button
                key={region.id}
                onClick={() => isUnlocked && setViewingRegionId(region.id)}
                disabled={!isUnlocked}
                className={`p-3 rounded-xl border text-left transition-all relative flex items-center gap-2.5 ${
                  isViewing
                    ? 'bg-slate-800/95 border-amber-400/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50'
                    : isUnlocked
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    : 'bg-slate-950/60 border-slate-900 opacity-60 cursor-not-allowed'
                }`}
              >
                <div
                  className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-lg shadow-inner"
                  style={{ backgroundColor: `${region.themeColor}25`, border: `1px solid ${region.themeColor}50` }}
                >
                  {region.icon}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100 font-['Baloo_2'] leading-snug truncate">
                    {region.shortName}
                  </h4>
                  {isUnlocked ? (
                    <p className="text-[10px] text-amber-400 font-mono">⭐ {starsTotal}/15{isPlaying ? ' · Jugando' : ''}</p>
                  ) : (
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> {prevRegion ? `Termina ${prevRegion.shortName}` : 'Bloqueada'}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Los 5 niveles de la región seleccionada */}
      <div className="w-full">
        <p className="text-xs text-slate-400 mb-2 px-1">
          {viewingRegion.icon} {viewingRegion.name} — los 5 desafíos, en orden:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {GAME_MODES.map((mode) => {
            const levelProgress = viewingProgress?.levels.find((l) => l.gameModeId === mode.id);
            const isUnlocked = levelProgress?.unlocked ?? mode.sortOrder === 1;
            const isPlaying = viewingRegionId === currentRegionId && mode.id === currentGameModeId;

            return (
              <button
                key={mode.id}
                onClick={() => isUnlocked && onSelectLevel(viewingRegionId, mode.id)}
                disabled={!isUnlocked}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between overflow-hidden group ${
                  isPlaying
                    ? 'bg-slate-800/95 border-amber-400/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50'
                    : isUnlocked
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    : 'bg-slate-950/60 border-slate-900 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between w-full mb-2">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-inner"
                    style={{
                      backgroundColor: `${viewingRegion.themeColor}25`,
                      border: `1px solid ${viewingRegion.themeColor}50`,
                    }}
                  >
                    {mode.icon}
                  </div>

                  {!isUnlocked ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />
                    </span>
                  ) : levelProgress && levelProgress.bestStars >= 3 ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Hecho
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-mono font-bold">
                      ⭐ {levelProgress?.bestStars ?? 0}/3
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100 font-['Baloo_2'] leading-snug group-hover:text-amber-300 transition-colors">
                    Nivel {mode.sortOrder} · {mode.name}
                  </h4>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  {isPlaying ? (
                    <span className="text-amber-400 font-bold">Jugando</span>
                  ) : isUnlocked ? (
                    <span className="text-blue-400 flex items-center group-hover:translate-x-0.5 transition-transform">
                      Jugar <ChevronRight className="w-3 h-3 ml-0.5" />
                    </span>
                  ) : (
                    <span className="text-slate-500">Completa el nivel anterior</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
