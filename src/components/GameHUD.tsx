import React from 'react';
import { Volume2, VolumeX, Map, BarChart3, RotateCcw, Pause } from 'lucide-react';
import { LevelDisplayInfo } from '../types';

interface GameHUDProps {
  currentLevel: LevelDisplayInfo;
  viewMode: 'map' | 'game';
  questionIndex: number;
  totalQuestions: number;
  score: number;
  lives: number;
  maxLives: number;
  combo: number;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpenMap: () => void;
  onOpenReport?: () => void;
  onResetGame: () => void;
  onPause?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  currentLevel,
  viewMode,
  questionIndex,
  totalQuestions,
  score,
  lives,
  maxLives,
  combo,
  isMuted,
  onToggleSound,
  onOpenMap,
  onOpenReport,
  onResetGame,
  onPause,
}) => {
  const progressPct = Math.min(100, (questionIndex / Math.max(1, totalQuestions)) * 100);

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 text-white px-4 py-3 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
      {/* Left: World / Map Branding */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMap}
          className={`flex items-center gap-2 px-3 py-1.5 pointer-coarse:min-h-11 rounded-xl border text-sm font-bold transition-all ${
            viewMode === 'map'
              ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
          }`}
          title="Ver mapa de las 4 regiones"
        >
          <Map className="w-4 h-4 text-amber-400" />
          <span>{viewMode === 'map' ? 'Mapa 3D' : 'Ir al Mapa'}</span>
        </button>

        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentLevel.icon}</span>
            <div>
              <h2 className="text-sm font-extrabold leading-none text-slate-100 font-['Baloo_2']">
                {currentLevel.name}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium leading-tight">
                {currentLevel.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Stage Progress (Only in Game Mode) */}
      {viewMode === 'game' && (
        <div className="flex flex-col items-center gap-1 w-36 sm:w-48">
          <div className="flex justify-between w-full text-[11px] font-mono text-slate-300">
            <span>Pregunta</span>
            <span className="font-bold text-amber-400">
              {Math.min(questionIndex + 1, totalQuestions)} / {totalQuestions}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Right: Stats, Lives, Combo, Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Score */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-full text-xs font-mono font-bold text-amber-300">
          <span>⭐</span>
          <span>{score}</span>
        </div>

        {/* Lives */}
        <div className="flex items-center gap-0.5 bg-slate-800/90 border border-slate-700 px-2.5 py-1.5 rounded-full text-xs" title={`${lives} vidas restantes`}>
          {Array.from({ length: maxLives }).map((_, i) => (
            <span
              key={i}
              className={`transition-opacity text-sm ${
                i < lives ? 'opacity-100 scale-100' : 'opacity-20 grayscale'
              }`}
            >
              ❤️
            </span>
          ))}
        </div>

        {/* Combo Badge */}
        {combo >= 2 && (
          <div className="hidden xs:flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
            <span>🔥</span>
            <span>x{Math.min(combo, 4)}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
          {viewMode === 'game' && onPause && (
            <button
              onClick={onPause}
              className="p-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-700 rounded-lg transition-colors"
              title="Pausar"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {viewMode === 'game' && (
            <button
              onClick={onResetGame}
              className="p-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-700 rounded-lg transition-colors"
              title="Reiniciar mundo actual"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {onOpenReport && (
            <button
              onClick={onOpenReport}
              className="p-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-700 rounded-lg transition-colors"
              title="Ver reporte pedagógico y competencias"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onToggleSound}
            className="p-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:justify-center text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-700 rounded-lg transition-colors"
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};
