import React, { useEffect, useState } from 'react';
import { ThreeWorldCanvas } from './ThreeWorldCanvas';
import { IllustratedWorldViewport } from './IllustratedWorldViewport';
import { DynamicParticleSystem } from './DynamicParticleSystem';
import { WeatherOverlay, getWeatherInfo, WeatherIntensity } from './WeatherOverlay';
import { GalaxyUnlockOverlay } from './GalaxyUnlockOverlay';
import { UniverseCompleteOverlay } from './UniverseCompleteOverlay';
import { GameMode, MathQuestion, RegionDefinition, RegionProgress } from '../types';
import { REGIONS } from '../data/regionsData';
import { Eye, Layers, Compass, ArrowLeft } from 'lucide-react';

interface WorldViewportProps {
  viewMode: 'map' | 'game';
  currentRegionId: string;
  gameMode: GameMode;
  questionIndex: number;
  totalQuestions: number;
  isCorrect: boolean | null;
  heroHp: number;
  enemyHp: number;
  bridgeBuiltSegments: number;
  raceProgress?: number;
  shopCartTotal?: number;
  cluesFound?: number;
  combo: number;
  gameWon?: boolean;
  gameOver?: boolean;
  activeQuestion: MathQuestion | null;
  onSelectRegion: (regionId: string) => void;
  onToggleViewMode: () => void;
  /** Id de la región recién desbloqueada: activa la celebración sobre el mapa. */
  unlockingRegionId?: string | null;
  previousRegionName?: string;
  onDismissUnlock?: () => void;
  /**
   * Gran Final "universo completado". Si viene (no null), se muestra encima del mapa y los
   * dos motores dibujan su versión (3D o ilustrada). Sin esta prop todo funciona como antes.
   */
  universeFinale?: {
    regions: RegionProgress[];
    totalXp: number;
    onExplore: () => void;
    onReplay: () => void;
  } | null;
}

export const WorldViewport: React.FC<WorldViewportProps> = ({
  viewMode,
  currentRegionId,
  gameMode,
  questionIndex,
  totalQuestions,
  isCorrect,
  heroHp,
  enemyHp,
  bridgeBuiltSegments,
  raceProgress = 0,
  shopCartTotal = 0,
  cluesFound = 0,
  combo,
  gameWon = false,
  gameOver = false,
  activeQuestion,
  onSelectRegion,
  onToggleViewMode,
  unlockingRegionId,
  previousRegionName,
  onDismissUnlock,
  universeFinale,
}) => {
  // Engine: 'three' (WebGL 3D) es el modo PRINCIPAL. 'illustrated' es el
  // respaldo si el navegador no soporta WebGL o el docente lo prefiere.
  const [engine, setEngine] = useState<'three' | 'illustrated'>('three');
  const [webGLError, setWebGLError] = useState(false);
  // Sistema de clima atmosférico: 'normal' | 'soft' (tenue) | 'off' (apagado)
  const [weatherIntensity, setWeatherIntensity] = useState<WeatherIntensity>('normal');

  const currentRegion: RegionDefinition =
    REGIONS.find((w) => w.id === currentRegionId) || REGIONS[0];

  const weatherInfo = getWeatherInfo(currentRegionId, viewMode);

  // Cada vez que se entra a un nivel o se cambia de región/juego, vuelve al 3D
  // (el modo principal), salvo que el WebGL ya haya fallado en este navegador.
  useEffect(() => {
    if (!webGLError) setEngine('three');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRegionId, gameMode]);

  const handleCycleWeather = () => {
    setWeatherIntensity((prev) => {
      if (prev === 'normal') return 'soft';
      if (prev === 'soft') return 'off';
      return 'normal';
    });
  };

  const handleToggleEngine = () => {
    if (engine === 'three') {
      setEngine('illustrated');
    } else {
      if (!webGLError) {
        setEngine('three');
      } else {
        alert('El modo 3D WebGL no está disponible en este navegador, mantendremos el Modo Ilustrado.');
      }
    }
  };

  return (
    <div className="relative w-full">
      {/* Top Floating Controls Bar */}
      <div
        className="absolute left-3 right-3 z-30 flex items-center justify-between pointer-events-auto"
        style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        {/* Left: Current World or Map Badge */}
        <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 pointer-coarse:min-h-10 rounded-full text-xs font-bold text-slate-200 shadow-lg">
          {viewMode === 'map' ? (
            <>
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>Mapa de las 4 Regiones</span>
            </>
          ) : (
            <>
              <span>{currentRegion.icon}</span>
              <span className="font-['Baloo_2']">{currentRegion.name}</span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">({currentRegion.competency})</span>
            </>
          )}
        </div>

        {/* Right: Weather Badge, Engine Switcher & Map Toggle */}
        <div className="flex items-center gap-2">
          {/* Weather Status & Intensity Control */}
          <button
            onClick={handleCycleWeather}
            className={`hidden sm:flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 border px-3 py-1.5 pointer-coarse:min-h-10 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md ${
              weatherIntensity === 'off'
                ? 'border-slate-700 text-slate-400 opacity-70'
                : 'border-slate-700/80 hover:border-sky-400/60 text-slate-200'
            }`}
            title={`Clima: ${weatherInfo.condition} (${
              weatherIntensity === 'normal'
                ? 'Intensidad Normal'
                : weatherIntensity === 'soft'
                ? 'Intensidad Tenue'
                : 'Desactivado'
            }). Haz clic para alternar.`}
          >
            <span>{weatherInfo.icon}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                weatherIntensity === 'normal'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : weatherIntensity === 'soft'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {weatherIntensity === 'normal' ? 'Normal' : weatherIntensity === 'soft' ? 'Tenue' : 'Off'}
            </span>
          </button>

          {/* Dual-Engine Toggle Button */}
          <button
            id="engine-toggle-btn"
            onClick={handleToggleEngine}
            className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-amber-400/60 px-3 py-1.5 pointer-coarse:min-h-10 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer"
            title="Alterna entre el Modo 3D WebGL y el Modo Ilustrado fiel a los archivos HTML"
          >
            {engine === 'three' ? (
              <>
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Modo: </span>
                <span className="text-amber-400">3D WebGL</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Modo: </span>
                <span className="text-emerald-300">Ilustrado Fiel</span>
              </>
            )}
          </button>

          {/* Quick Map / Game Switcher */}
          <button
            id="map-game-toggle-btn"
            onClick={onToggleViewMode}
            className="flex items-center gap-1 bg-blue-600/90 hover:bg-blue-500 text-white border border-blue-400 px-3 py-1.5 pointer-coarse:min-h-10 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            {viewMode === 'map' ? (
              <>
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a Jugar</span>
              </>
            ) : (
              <>
                <Compass className="w-3.5 h-3.5" />
                <span>Ver Mapa</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Render Active Viewport Engine */}
      {engine === 'three' && !webGLError ? (
        <ThreeWorldCanvas
          viewMode={viewMode}
          currentRegionId={currentRegionId}
          gameMode={gameMode}
          questionIndex={questionIndex}
          totalQuestions={totalQuestions}
          isCorrect={isCorrect}
          heroHp={heroHp}
          enemyHp={enemyHp}
          bridgeBuiltSegments={bridgeBuiltSegments}
          raceProgress={raceProgress}
          shopCartTotal={shopCartTotal}
          cluesFound={cluesFound}
          gameWon={gameWon}
          gameOver={gameOver}
          onSelectRegion={onSelectRegion}
          unlockingRegionId={unlockingRegionId}
          universeFinaleActive={!!universeFinale}
          onWebGLError={() => {
            setWebGLError(true);
            setEngine('illustrated');
          }}
        />
      ) : (
        <IllustratedWorldViewport
          viewMode={viewMode}
          currentRegionId={currentRegionId}
          gameMode={gameMode}
          questionIndex={questionIndex}
          totalQuestions={totalQuestions}
          isCorrect={isCorrect}
          heroHp={heroHp}
          enemyHp={enemyHp}
          bridgeBuiltSegments={bridgeBuiltSegments}
          raceProgress={raceProgress}
          shopCartTotal={shopCartTotal}
          cluesFound={cluesFound}
          combo={combo}
          gameWon={gameWon}
          gameOver={gameOver}
          activeQuestion={activeQuestion}
          onSelectRegion={onSelectRegion}
          universeFinaleActive={!!universeFinale}
        />
      )}

      {/* Gran Final "universo completado" (sobre cualquiera de los dos motores, 3D o ilustrado) */}
      {viewMode === 'map' && universeFinale && (
        <UniverseCompleteOverlay
          regions={universeFinale.regions}
          totalXp={universeFinale.totalXp}
          onExplore={universeFinale.onExplore}
          onReplay={universeFinale.onReplay}
          onPlayRegion={onSelectRegion}
        />
      )}

      {/* Celebración "Mario Galaxy" de región recién desbloqueada (sobre
          cualquiera de los dos motores, 3D o ilustrado) */}
      {viewMode === 'map' && unlockingRegionId && !universeFinale && (
        <GalaxyUnlockOverlay
          key={unlockingRegionId} // si hay varias celebraciones en cola, cada una arranca desde cero
          region={REGIONS.find((r) => r.id === unlockingRegionId) || REGIONS[0]}
          previousRegionName={previousRegionName}
          onPlayRegion={() => onSelectRegion(unlockingRegionId)}
          onDismiss={onDismissUnlock || (() => {})}
        />
      )}

      {/* Capa de clima atmosférico (sol/niebla/calima/aurora según la región) */}
      <WeatherOverlay
        worldId={currentRegionId}
        viewMode={viewMode}
        intensity={weatherIntensity}
      />

      {/* Capa de partículas (reacciona a aciertos, combos, victoria/derrota) */}
      <DynamicParticleSystem
        gameMode={gameMode}
        isCorrect={isCorrect}
        gameWon={gameWon}
        gameOver={gameOver}
        combo={combo}
        raceProgress={raceProgress}
        shopCartTotal={shopCartTotal}
        questionIndex={questionIndex}
      />
    </div>
  );
};
