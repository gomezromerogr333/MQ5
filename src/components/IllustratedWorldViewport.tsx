import React from 'react';
import { REGIONS } from '../data/regionsData';
import { GameMode, RegionDefinition, MathQuestion } from '../types';
import { Sparkles, Shield, Heart, Zap, Award, CheckCircle2, Lock } from 'lucide-react';

interface IllustratedWorldViewportProps {
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
  activeQuestion: MathQuestion | null;
  gameWon?: boolean;
  gameOver?: boolean;
  onSelectRegion: (regionId: string) => void;
  /** Gran Final "universo completado" activo: dibuja la Gran Estrella y los haces de luz sobre el mapa. */
  universeFinaleActive?: boolean;
}

/**
 * Centro visual de cada isla en el mapa 2D (viewBox 1000×600): su `translate(...)` más el
 * centro de su plataforma (+80, +70). Los haces del Gran Final salen de aquí.
 */
const FINALE_2D_ISLAND_CENTERS: Record<string, [number, number]> = {
  bosque: [210, 430],
  montana: [430, 290],
  ciudad: [680, 350],
  castillo: [290, 140],
};
/** Dónde se dibuja la Gran Estrella en el mapa 2D. */
const FINALE_2D_STAR: [number, number] = [500, 270];

const OutcomeOverlay: React.FC<{
  gameWon?: boolean;
  gameOver?: boolean;
  gameMode: GameMode;
}> = ({ gameWon, gameOver, gameMode }) => {
  if (!gameWon && !gameOver) return null;

  const winTitles: Record<GameMode, { title: string; subtitle: string; icon: string }> = {
    race: { title: '¡CARRERA GANADA!', subtitle: '¡Cruzaste la meta en 1º puesto con gran aceleración!', icon: '🏆' },
    battle: { title: '¡VICTORIA ÉPICA!', subtitle: '¡Has derrotado al temible Guardián de Roca!', icon: '⚔️' },
    shop: { title: '¡TIENDA REPLETA DE ORO!', subtitle: '¡Don Mateo celebró el récord histórico de ventas!', icon: '💰' },
    bridge: { title: '¡PUENTE COMPLETADO!', subtitle: '¡El explorador cruzó el cañón a salvo!', icon: '🚩' },
    detective: { title: '¡ENIGMA RESUELTO!', subtitle: '¡La cámara acorazada del castillo se ha abierto!', icon: '💎' },
  };

  const loseTitles: Record<GameMode, { title: string; subtitle: string; icon: string }> = {
    race: { title: '¡CARRERA PERDIDA!', subtitle: 'Te quedaste sin energía en la pista.', icon: '🏃💨' },
    battle: { title: '¡DERROTA EN COMBATE!', subtitle: 'El héroe no pudo resistir el embate del Guardián.', icon: '🛡️💥' },
    shop: { title: '¡TIENDA CERRADA!', subtitle: 'Don Mateo ha tenido que cerrar el puesto.', icon: '📦🚫' },
    bridge: { title: '¡PUENTE DERRUMBADO!', subtitle: 'Las tablas del puente cedieron en el cañón.', icon: '🌉💥' },
    detective: { title: '¡PORTÓN BLOQUEADO!', subtitle: 'El sistema de cerrojos del castillo se ha trabado.', icon: '🔒⚡' },
  };

  const info = gameWon ? winTitles[gameMode] : loseTitles[gameMode];

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-sm animate-fade-in pointer-events-none p-4 text-center overflow-hidden">
      {/* Confeti CSS en cascada, solo en victoria */}
      {gameWon && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-3.5 rounded-sm animate-confetti-twirl opacity-90 shadow-sm"
              style={{
                left: `${(i * 100) / 22 + (i % 2) * 1.5}%`,
                backgroundColor: ['#fbbf24', '#f43f5e', '#38bdf8', '#34d399', '#a855f7', '#f97316', '#ffffff'][i % 7],
                animationDelay: `${(i * 0.11).toFixed(2)}s`,
                animationDuration: `${1.9 + (i % 4) * 0.35}s`,
              }}
            />
          ))}
        </div>
      )}

      <div
        className={`relative z-10 p-6 rounded-2xl border-2 shadow-2xl max-w-sm w-full transform animate-bounce-once ${
          gameWon ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.3)]'
        }`}
      >
        <div className="text-5xl mb-3">{info.icon}</div>
        <h2 className="text-xl font-black font-fredoka tracking-wide mb-1.5">{info.title}</h2>
        <p className="text-xs text-slate-300 font-medium leading-relaxed mb-3">{info.subtitle}</p>
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            gameWon ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          <span>{gameWon ? '✨ ¡Misión completada con éxito!' : '⚠️ Inténtalo de nuevo para triunfar'}</span>
        </div>
      </div>
    </div>
  );
};

export const IllustratedWorldViewport: React.FC<IllustratedWorldViewportProps> = ({
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
  activeQuestion,
  gameWon = false,
  gameOver = false,
  onSelectRegion,
  universeFinaleActive,
}) => {
  const currentRegion = REGIONS.find((w) => w.id === currentRegionId) || REGIONS[0];

  // -------------------------------------------------------------
  // 1. WORLD MAP VIEW (Directly inspired by File 3: Mapa del Mundo v2)
  // -------------------------------------------------------------
  if (viewMode === 'map') {
    return (
      <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] short:h-[46dvh] overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c182c] select-none shadow-2xl">
        {/* SVG World Map */}
        <svg
          viewBox="0 0 1000 600"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Water dots grid pattern */}
            <pattern id="mapWaterDots" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="16" cy="16" r="1.5" fill="#38bdf8" fillOpacity="0.22" />
            </pattern>

            {/* Island 1 Grass Gradient */}
            <linearGradient id="grassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5FCB6D" />
              <stop offset="100%" stopColor="#3FA34D" />
            </linearGradient>

            {/* Island Cliff Gradient */}
            <linearGradient id="cliffGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8C6A3F" />
              <stop offset="100%" stopColor="#5C4528" />
            </linearGradient>

            {/* Mountain Gradient */}
            <linearGradient id="mountainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#9A4988" />
              <stop offset="100%" stopColor="#692257" />
            </linearGradient>

            {/* City Purple Gradient */}
            <linearGradient id="cityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#5B21B6" />
            </linearGradient>

            {/* River Blue Gradient */}
            <linearGradient id="riverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            {/* Castle Gradient */}
            <linearGradient id="castleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#9D174D" />
            </linearGradient>

            {/* Drop Shadow */}
            <filter id="islandShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#020617" floodOpacity="0.75" />
            </filter>
          </defs>

          {/* Water Background */}
          <rect width="1000" height="600" fill="#0c182c" />
          <rect width="1000" height="600" fill="url(#mapWaterDots)" />

          {/* Stylized Ocean Waves Ripple Rings */}
          <circle cx="210" cy="460" r="115" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.18" />
          <circle cx="430" cy="310" r="105" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.18" />
          <circle cx="680" cy="380" r="110" fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.18" />
          <circle cx="790" cy="180" r="100" fill="none" stroke="#0ea5e9" strokeWidth="1" opacity="0.18" />
          <circle cx="280" cy="160" r="105" fill="none" stroke="#ec4899" strokeWidth="1" opacity="0.18" />

          {/* Connecting Dashed Nautical Sea Trail */}
          <path
            d="M 210 440 C 270 380, 360 360, 430 310 C 510 270, 590 350, 680 370 C 760 380, 810 280, 790 190 C 740 110, 430 110, 290 160"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="3.5"
            strokeDasharray="9 9"
            opacity="0.7"
          />

          {/* Gran Final: Gran Estrella central y un haz de luz desde cada región (motor de respaldo) */}
          {universeFinaleActive && (
            <g id="universe-grand-star-svg" className="animate-in fade-in zoom-in duration-700" pointerEvents="none">
              {REGIONS.map((r) => {
                const c = FINALE_2D_ISLAND_CENTERS[r.id];
                if (!c) return null;
                return (
                  <line
                    key={r.id}
                    x1={c[0]}
                    y1={c[1]}
                    x2={FINALE_2D_STAR[0]}
                    y2={FINALE_2D_STAR[1]}
                    stroke={r.themeColor}
                    strokeWidth="4"
                    strokeDasharray="8 6"
                    opacity="0.85"
                  />
                );
              })}
              <circle cx={FINALE_2D_STAR[0]} cy={FINALE_2D_STAR[1]} r="90" fill="#fef08a" opacity="0.25" className="animate-pulse" />
              <circle cx={FINALE_2D_STAR[0]} cy={FINALE_2D_STAR[1]} r="65" fill="#fde047" opacity="0.4" />
              <circle
                cx={FINALE_2D_STAR[0]}
                cy={FINALE_2D_STAR[1]}
                r="115"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="3"
                strokeDasharray="12 8"
                opacity="0.75"
              />
              <path
                d="M 500 200 L 518 250 L 570 250 L 528 280 L 545 330 L 500 300 L 455 330 L 472 280 L 430 250 L 482 250 Z"
                fill="#fbbf24"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Floating Animated Clouds */}
          <g opacity="0.55">
            <ellipse cx="140" cy="90" rx="60" ry="18" fill="#ffffff" opacity="0.2" />
            <ellipse cx="170" cy="80" rx="40" ry="24" fill="#ffffff" opacity="0.3" />
            <ellipse cx="620" cy="70" rx="80" ry="22" fill="#ffffff" opacity="0.25" />
            <ellipse cx="880" cy="460" rx="70" ry="20" fill="#ffffff" opacity="0.2" />
          </g>

          {/* ================= ISLAND 1: BOSQUE (Carrera) ================= */}
          <g
            id="island-btn-bosque"
            onClick={() => onSelectRegion('bosque')}
            className="cursor-pointer group"
            transform="translate(130, 360)"
          >
            {/* Shadow & Cliff */}
            <ellipse cx="80" cy="120" rx="85" ry="38" fill="#030712" opacity="0.5" />
            <path
              d="M 10 75 Q 80 120 150 75 L 150 100 Q 80 145 10 100 Z"
              fill="url(#cliffGrad)"
              filter="url(#islandShadow)"
            />
            {/* Grass Top */}
            <ellipse cx="80" cy="70" rx="75" ry="36" fill="url(#grassGrad)" stroke="#86efac" strokeWidth="2" />
            {/* Road path */}
            <path d="M 30 72 Q 80 60 130 75" stroke="#fef08a" strokeWidth="6" fill="none" strokeDasharray="6 4" />
            {/* Pine Trees */}
            <polygon points="50,60 40,75 60,75" fill="#14532d" />
            <polygon points="50,50 43,62 57,62" fill="#15803d" />
            <polygon points="110,55 100,72 120,72" fill="#14532d" />
            {/* Runner Avatar miniature */}
            <circle cx="80" cy="48" r="8" fill="#fed7aa" />
            <rect x="74" y="56" width="12" height="14" rx="3" fill="#2563eb" />
            {/* Badge */}
            <rect x="25" y="10" width="110" height="26" rx="13" fill="#1e293b" stroke="#3fa34d" strokeWidth="2" />
            <text x="80" y="27" textAnchor="middle" fill="#86efac" fontSize="11" fontWeight="bold" fontFamily="Baloo 2">
              🌳 Bosque de la Suma
            </text>
          </g>

          {/* ================= ISLAND 2: MONTAÑA (Batalla) ================= */}
          <g
            id="island-btn-montana"
            onClick={() => onSelectRegion('montana')}
            className="cursor-pointer group"
            transform="translate(350, 220)"
          >
            <ellipse cx="80" cy="120" rx="85" ry="38" fill="#030712" opacity="0.5" />
            <path
              d="M 10 75 Q 80 120 150 75 L 150 105 Q 80 150 10 105 Z"
              fill="#5c4033"
              filter="url(#islandShadow)"
            />
            {/* Rocky Arena Top */}
            <ellipse cx="80" cy="70" rx="75" ry="36" fill="url(#mountainGrad)" stroke="#f472b6" strokeWidth="2" />
            {/* Arena Ring */}
            <ellipse cx="80" cy="70" rx="48" ry="22" fill="none" stroke="#fbbf24" strokeWidth="3" />
            {/* Mini Sword & Shield Icons */}
            <text x="80" y="74" textAnchor="middle" fontSize="18">⚔️</text>
            {/* Badge */}
            <rect x="20" y="10" width="120" height="26" rx="13" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
            <text x="80" y="27" textAnchor="middle" fill="#fde68a" fontSize="11" fontWeight="bold" fontFamily="Baloo 2">
              ⛰️ Montaña de la Resta
            </text>
          </g>

          {/* ================= ISLAND 3: CIUDAD (Tienda) ================= */}
          <g
            id="island-btn-ciudad"
            onClick={() => onSelectRegion('ciudad')}
            className="cursor-pointer group"
            transform="translate(600, 280)"
          >
            <ellipse cx="80" cy="120" rx="85" ry="38" fill="#030712" opacity="0.5" />
            <path
              d="M 10 75 Q 80 120 150 75 L 150 100 Q 80 145 10 100 Z"
              fill="#4a2870"
              filter="url(#islandShadow)"
            />
            {/* Plaza Top */}
            <ellipse cx="80" cy="70" rx="75" ry="36" fill="url(#cityGrad)" stroke="#c084fc" strokeWidth="2" />
            {/* Market Awning mini */}
            <rect x="62" y="44" width="36" height="18" rx="4" fill="#a855f7" stroke="#fbbf24" strokeWidth="1.5" />
            <text x="80" y="58" textAnchor="middle" fontSize="12">🛒</text>
            {/* Badge */}
            <rect x="25" y="10" width="110" height="26" rx="13" fill="#1e293b" stroke="#8b5cf6" strokeWidth="2" />
            <text x="80" y="27" textAnchor="middle" fill="#e9d5ff" fontSize="11" fontWeight="bold" fontFamily="Baloo 2">
              🏙️ Ciudad de la Multiplicación
            </text>
          </g>

          {/* ================= ISLAND 4: CASTILLO (División) ================= */}
          <g
            id="island-btn-castillo"
            onClick={() => onSelectRegion('castillo')}
            className="cursor-pointer group"
            transform="translate(210, 70)"
          >
            <ellipse cx="80" cy="120" rx="85" ry="38" fill="#030712" opacity="0.5" />
            <path
              d="M 10 75 Q 80 120 150 75 L 150 100 Q 80 145 10 100 Z"
              fill="#581c87"
              filter="url(#islandShadow)"
            />
            {/* Castle Ground Top */}
            <ellipse cx="80" cy="70" rx="75" ry="36" fill="url(#castleGrad)" stroke="#f472b6" strokeWidth="2" />
            {/* Citadel Towers mini */}
            <rect x="68" y="38" width="24" height="28" rx="3" fill="#831843" stroke="#fbcfe8" strokeWidth="1" />
            <polygon points="65,38 80,20 95,38" fill="#fbbf24" />
            <text x="80" y="58" textAnchor="middle" fontSize="12">➗</text>
            {/* Badge */}
            <rect x="20" y="2" width="120" height="26" rx="13" fill="#1e293b" stroke="#ec4899" strokeWidth="2" />
            <text x="80" y="19" textAnchor="middle" fill="#fbcfe8" fontSize="11" fontWeight="bold" fontFamily="Baloo 2">
              🏰 Castillo de la División
            </text>
          </g>
        </svg>

        {/* Bottom Helper Bar */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700/80 text-xs text-slate-200 pointer-events-none shadow-lg">
          <span className="text-amber-400">✨</span>
          <span>Toca cualquier isla para viajar y jugar su desafío 3D</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. WORLD 1: BOSQUE — Carrera Matemática (File 1 Style)
  // -------------------------------------------------------------
  if (gameMode === 'race') {
    // Real distance calculations: 0 to 500m
    const currentProgress = Math.max(0, Math.min(100, raceProgress || (questionIndex / totalQuestions) * 100));
    const currentMeters = Math.round(currentProgress * 5); // 0m to 500m
    
    // Perspective positioning: from bottom 14px (scale 1.15) up to bottom 125px (scale 0.7)
    const runnerBottomPx = 14 + (currentProgress / 100) * 110;
    const runnerScale = 1.15 - (currentProgress / 100) * 0.45;

    // Rival Runner (Corredor Mateo): paces based on question index
    const rivalProgress = Math.min(95, 20 + questionIndex * 16);
    const rivalMeters = Math.round(rivalProgress * 5);
    const rivalBottomPx = 14 + (rivalProgress / 100) * 110;
    const rivalScale = 1.15 - (rivalProgress / 100) * 0.45;

    const isPlayerLeading = currentMeters >= rivalMeters;

    return (
      <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] short:h-[46dvh] overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-[#38bdf8]/40 via-[#1e293b] to-[#0f172a] shadow-2xl select-none flex flex-col justify-end">
        {/* Sky with clouds */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-10 w-28 h-8 bg-white/20 rounded-full blur-sm animate-pulse" />
          <div className="absolute top-8 right-16 w-36 h-10 bg-white/25 rounded-full blur-sm" />
          {/* Mountain silhouettes */}
          <div className="absolute top-12 left-0 right-0 h-28 flex items-end justify-around opacity-30">
            <div className="w-48 h-20 bg-slate-600 rounded-t-full" />
            <div className="w-64 h-28 bg-slate-500 rounded-t-full" />
            <div className="w-56 h-22 bg-slate-600 rounded-t-full" />
          </div>
        </div>

        {/* Speedlines on Combo or Correct Answer Sprint */}
        {(combo >= 2 || isCorrect === true) && (
          <div className="absolute inset-0 pointer-events-none opacity-40 z-10">
            <div className="w-full h-full bg-[repeating-linear-gradient(90deg,transparent_0_40px,rgba(255,255,255,0.15)_40px_42px)] animate-speedlines" />
          </div>
        )}

        {/* 3D Track & Terrain Section */}
        <div className="relative w-full h-[220px] sm:h-[260px] flex items-end justify-center">
          {/* Grass Landscape */}
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[#2d6a33] via-[#3fa34d] to-[#5fcb6d] rounded-b-2xl overflow-hidden shadow-inner">
            {/* Side Cliff Layer */}
            <div className="absolute bottom-0 inset-x-0 h-6 bg-[#6b4e28]" />

            {/* Checkered Finish Line Banner Arch across the track at top */}
            <div className="absolute inset-x-0 top-6 z-10 flex justify-center pointer-events-none">
              <div className="flex items-center gap-2 bg-slate-950/90 border-2 border-amber-400 px-4 py-1 rounded-full shadow-2xl">
                <span className="text-sm">🏁</span>
                <span className="text-[10px] font-black tracking-widest text-amber-300 font-mono">
                  META · 500m
                </span>
                <span className="text-sm">🏁</span>
              </div>
            </div>

            {/* Scrolling Road Path with Real Perspective & Dashed Line */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 bottom-0 w-56 sm:w-68 md:w-80 h-full bg-[#c7b37e] border-x-4 border-[#8c6a3f] overflow-hidden flex justify-center ${
                isCorrect ? 'animate-path-scroll [animation-duration:0.22s]' : 'animate-path-scroll'
              }`}
              style={{
                clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
                backgroundImage:
                  'repeating-linear-gradient(to top, #d9c89a 0px, #d9c89a 28px, #c7b37e 28px, #c7b37e 56px)',
                backgroundSize: '100% 56px',
              }}
            >
              {/* Lane Divider Center Dashes */}
              <div
                className="w-3 h-full opacity-70"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to top, #ffffff 0px, #ffffff 28px, transparent 28px, transparent 56px)',
                  backgroundSize: '100% 56px',
                }}
              />
            </div>

            {/* Real Distance Checkpoint Markers on the roadside */}
            <div className="absolute inset-x-4 sm:inset-x-8 top-1 flex justify-between pointer-events-none z-10">
              {[0, 100, 200, 300, 400, 500].map((meters) => {
                const reached = currentMeters >= meters;
                return (
                  <div
                    key={meters}
                    className={`flex flex-col items-center transition-transform duration-300 ${
                      reached ? 'scale-110 text-emerald-300 font-bold' : 'text-slate-400 opacity-60'
                    }`}
                  >
                    <span className="text-[9px] font-mono flex items-center gap-0.5">
                      {meters === 500 ? '🏁 500m' : `${meters}m`}
                    </span>
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-0.5 transition-colors ${
                        reached ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-700'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Trees passing by with wind swaying */}
            <div className="absolute bottom-8 left-6 sm:left-12 flex flex-col items-center animate-breathe">
              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-b-[36px] border-l-transparent border-r-transparent border-b-emerald-800" />
              <div className="w-3 h-5 bg-amber-900" />
            </div>
            <div className="absolute bottom-16 left-2 sm:left-5 flex flex-col items-center opacity-75">
              <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-b-[28px] border-l-transparent border-r-transparent border-b-emerald-700" />
              <div className="w-2.5 h-4 bg-amber-900" />
            </div>
            <div className="absolute bottom-10 right-6 sm:right-12 flex flex-col items-center animate-breathe">
              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-b-[36px] border-l-transparent border-r-transparent border-b-emerald-800" />
              <div className="w-3 h-5 bg-amber-900" />
            </div>
            <div className="absolute bottom-18 right-2 sm:right-5 flex flex-col items-center opacity-75">
              <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-b-[28px] border-l-transparent border-r-transparent border-b-emerald-700" />
              <div className="w-2.5 h-4 bg-amber-900" />
            </div>
          </div>

          {/* RIVAL RUNNER (Carril Izquierdo: Mateo) with Real Physical Track Distance */}
          <div
            className="absolute left-1/2 -translate-x-16 pointer-events-none z-15 transition-all duration-700 ease-out flex flex-col items-center"
            style={{
              bottom: `${rivalBottomPx}px`,
              transform: `scale(${rivalScale})`,
            }}
          >
            <div className="bg-slate-900/90 text-amber-400 text-[8px] font-mono px-1.5 py-0.2 rounded-full border border-amber-500/40 mb-0.5 whitespace-nowrap">
              🥈 Rival {rivalMeters}m
            </div>
            <div className="w-6 h-6 rounded-full bg-[#e2a878] border border-slate-700 flex items-center justify-center">
              <div className="w-full h-1 bg-amber-500 rounded-t-full -mt-2" />
            </div>
            <div className="w-5 h-7 bg-amber-600 rounded-md -mt-1 flex items-center justify-center text-[7px] font-bold text-white">
              2º
            </div>
            <div className="flex gap-1 -mt-0.5 justify-center">
              <div className="w-1.5 h-4 bg-amber-900 rounded-b animate-run-l" />
              <div className="w-1.5 h-4 bg-amber-900 rounded-b animate-run-r" />
            </div>
          </div>

          {/* PLAYER RUNNER (Carril Derecho: Tú) with Real Advancement & Real Stumble Retreat */}
          <div
            className={`absolute left-1/2 translate-x-4 z-20 flex flex-col items-center transition-all duration-500 ease-out ${
              isCorrect === true
                ? 'animate-turbo-surge'
                : isCorrect === false
                ? 'animate-trip-retreat'
                : 'animate-bob'
            }`}
            style={{
              bottom: `${runnerBottomPx}px`,
              transform: `scale(${runnerScale})`,
            }}
          >
            {/* Feedback Floating Banner on Answer */}
            {isCorrect === true && (
              <div className="absolute -top-14 animate-float-up bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-xs font-black font-mono px-3 py-1 rounded-full shadow-2xl border-2 border-white flex items-center gap-1 z-30 whitespace-nowrap">
                <span>🚀 ¡AVANCE! +100m ({currentMeters}m)</span>
              </div>
            )}
            {isCorrect === false && (
              <div className="absolute -top-14 animate-float-up bg-gradient-to-r from-rose-600 to-red-500 text-white text-xs font-black font-mono px-3 py-1 rounded-full shadow-2xl border-2 border-white flex items-center gap-1 z-30 whitespace-nowrap">
                <span>⚠️ ¡TROPIEZO! Retrocedes (-70m)</span>
              </div>
            )}

            {/* Distance badge above head */}
            <div className="bg-blue-900/90 text-sky-200 text-[8px] font-mono px-1.5 py-0.2 rounded-full border border-sky-400/50 mb-0.5 whitespace-nowrap font-bold">
              🥇 Tú {currentMeters}m
            </div>

            {/* Head with Animated Eyes & Cap Visor */}
            <div className="w-10 h-10 rounded-full bg-[#f2b98a] border-2 border-[#d98b50] relative shadow-md flex items-center justify-center">
              {/* Cap with wind visor */}
              <div className="absolute -top-1.5 inset-x-0 h-3.5 bg-red-500 rounded-t-full shadow-sm flex items-center justify-end pr-0.5">
                <div className="w-2.5 h-1 bg-red-700 rounded-full" />
              </div>
              {/* Eyes */}
              <div className="flex gap-2.5 mt-1">
                <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
              </div>
              {/* Smile / Shock expression */}
              {isCorrect === false ? (
                <div className="absolute bottom-1 w-2.5 h-2.5 bg-red-900 rounded-full" />
              ) : (
                <div className="absolute bottom-1.5 w-3.5 h-1 border-b-2 border-slate-800 rounded-full" />
              )}
            </div>

            {/* Torso & Articulated Running Arms */}
            <div className="relative flex items-center justify-center">
              {/* Left Arm */}
              <div
                className={`absolute -left-3 top-1 w-2.5 h-6 bg-[#2557a7] rounded-full shadow-sm flex flex-col justify-end items-center ${
                  isCorrect === false ? 'rotate-45' : 'animate-arm-l'
                }`}
              >
                <div className="w-2.5 h-2.5 bg-[#f2b98a] rounded-full" />
              </div>

              {/* Torso with 3º Grade Badge */}
              <div className="w-9 h-11 bg-[#2d6fd4] rounded-lg relative shadow-md border-t-2 border-blue-400 flex items-center justify-center">
                <div className="absolute -left-1.5 top-1.5 w-2 h-7 bg-amber-600 rounded-l shadow-sm" />
                <div className="text-[10px] font-black text-blue-100">3º</div>
              </div>

              {/* Right Arm */}
              <div
                className={`absolute -right-3 top-1 w-2.5 h-6 bg-[#2557a7] rounded-full shadow-sm flex flex-col justify-end items-center ${
                  isCorrect === false ? '-rotate-45' : 'animate-arm-r'
                }`}
              >
                <div className="w-2.5 h-2.5 bg-[#f2b98a] rounded-full" />
              </div>
            </div>

            {/* Running Legs & Sneakers */}
            <div className="flex gap-2.5 -mt-0.5">
              <div
                className={`w-2.5 h-7 bg-blue-900 rounded-b flex flex-col justify-end ${
                  isCorrect === false ? 'rotate-12' : 'animate-run-l'
                }`}
              >
                <div className="w-4 h-2 bg-red-500 rounded-r shadow-sm" />
              </div>
              <div
                className={`w-2.5 h-7 bg-blue-900 rounded-b flex flex-col justify-end ${
                  isCorrect === false ? '-rotate-12' : 'animate-run-r'
                }`}
              >
                <div className="w-4 h-2 bg-red-500 rounded-r shadow-sm" />
              </div>
            </div>

            {/* Ground Dust Puffs */}
            <div className="absolute -bottom-2 flex gap-4 pointer-events-none opacity-60">
              <div className="w-3 h-3 bg-amber-200/80 rounded-full animate-dust" />
              <div className="w-2.5 h-2.5 bg-amber-200/60 rounded-full animate-dust" />
            </div>
          </div>
        </div>

        {/* Real-time Race Leaderboard HUD */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-30">
          <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-500/50 text-xs font-bold text-emerald-300 flex items-center gap-2 shadow-lg">
            <span>{isPlayerLeading ? '🥇 1º Puesto (Líder)' : '🥈 2º Puesto (A la caza)'}</span>
            <span className="font-mono text-white">· {currentMeters}m / 500m</span>
          </div>

          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1.5 shadow-lg">
            <span className="text-amber-400">Rival:</span>
            <span className="text-amber-300 font-bold">{rivalMeters}m</span>
          </div>
        </div>

        {/* Win/Loss Status Overlay */}
        <OutcomeOverlay gameWon={gameWon} gameOver={gameOver} gameMode={gameMode} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. WORLD 2: MONTAÑA — Batalla en Arena
  // -------------------------------------------------------------
  if (gameMode === 'battle') {
    return (
      <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] short:h-[46dvh] overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-[#4a1d4a] via-[#1e142b] to-[#0d0914] shadow-2xl select-none flex flex-col justify-between p-4">
        {/* Floating Arena Island with Magma Cracks */}
        <div className="absolute inset-x-6 bottom-6 h-36 bg-gradient-to-b from-[#831843] via-[#701a75] to-[#4a044e] rounded-[50px] border-4 border-[#f472b6]/60 shadow-[0_25px_50px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Arena Ring with Ancient Runes */}
          <div className="absolute inset-4 rounded-[40px] border-2 border-amber-400/50 flex items-center justify-around opacity-30 text-amber-200 text-xs font-mono">
            <span>ᛟ</span>
            <span>ᚦ</span>
            <span>ᚱ</span>
            <span>ᚨ</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-7 bg-[#3b0764] flex items-center justify-center">
            <div className="w-48 h-1 bg-rose-500/40 rounded-full blur-[1px] animate-pulse" />
          </div>
        </div>

        {/* Floating Rock Shards in background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-16 left-12 w-6 h-6 bg-slate-700 rounded-md rotate-12 opacity-40 animate-bob" />
          <div className="absolute top-24 right-16 w-8 h-8 bg-slate-800 rounded-lg -rotate-12 opacity-40 animate-bob" />
        </div>

        {/* Top Battle Health Bars */}
        <div className="relative z-20 flex justify-between items-center w-full max-w-lg mx-auto gap-4">
          {/* Hero HP */}
          <div className="flex-1 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-blue-500/40 shadow-lg">
            <div className="flex justify-between text-xs font-bold text-blue-300 mb-1">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-400" /> Héroe (Tú)
              </span>
              <span className="font-mono">{Math.max(0, heroHp)}%</span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(0, heroHp)}%` }}
              />
            </div>
          </div>

          <div className="text-xs font-black font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/30">
            VS
          </div>

          {/* Enemy HP */}
          <div className="flex-1 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-rose-500/40 shadow-lg">
            <div className="flex justify-between text-xs font-bold text-rose-300 mb-1">
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-400" /> Guardián de Roca
              </span>
              <span className="font-mono">{Math.max(0, enemyHp)}%</span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-300 rounded-full float-right"
                style={{ width: `${Math.max(0, enemyHp)}%` }}
              />
            </div>
          </div>
        </div>

        {/* REAL COMBAT ARENA: DIRECT DASH MELEE ATTACKS */}
        <div className={`relative z-20 flex items-center justify-between h-48 w-full max-w-xl mx-auto px-8 ${isCorrect === false ? 'animate-fissure-shake' : ''}`}>
          {/* HERO FIGHTER: DASHES ACROSS TO STRIKE GUARDIAN */}
          <div
            className={`flex flex-col items-center relative transition-all ${
              isCorrect === true
                ? 'animate-dash-attack z-40'
                : isCorrect === false
                ? 'animate-hit-shake'
                : 'animate-breathe'
            }`}
          >
            {/* Luminous Claymore Blade */}
            <div
              className={`absolute -right-6 top-2 w-3 h-20 bg-gradient-to-t from-sky-400 via-sky-200 to-white rounded-sm shadow-[0_0_20px_#38bdf8] border border-white transition-transform ${
                isCorrect === true ? 'rotate-90 translate-y-3' : 'rotate-45'
              }`}
            />

            {/* Protective Shield Barrier when hit */}
            {isCorrect === false && (
              <div className="absolute inset-0 -m-5 rounded-full border-2 border-rose-500/90 animate-shield-glow pointer-events-none" />
            )}

            {/* Helmet / Head */}
            <div className="w-12 h-12 rounded-full bg-[#fed7aa] border-2 border-slate-700 relative flex items-center justify-center shadow-md">
              <div className="absolute -top-2 inset-x-0 h-4 bg-blue-600 rounded-t-full border border-blue-400" />
              <div className="w-2 h-2 bg-slate-900 rounded-full mr-1.5" />
              <div className="w-2 h-2 bg-slate-900 rounded-full" />
              {isCorrect === false && (
                <div className="absolute -top-4 text-xs">💫</div>
              )}
            </div>

            {/* Armor Body */}
            <div className="w-11 h-14 bg-blue-600 rounded-xl border-2 border-blue-400 shadow-md flex items-center justify-center text-white text-xs font-bold mt-0.5">
              ⚔️
            </div>

            {/* Legs */}
            <div className="flex gap-2">
              <div className="w-3 h-6 bg-slate-800 rounded-b" />
              <div className="w-3 h-6 bg-slate-800 rounded-b" />
            </div>
          </div>

          {/* DYNAMIC SLASH IMPACT ARCS & EXPLODING ROCK DEBRIS */}
          {isCorrect === true && (
            <div className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none z-35 flex flex-col items-center">
              <svg className="w-36 h-36 animate-slash-arc" viewBox="0 0 100 100">
                <path
                  d="M 15 85 Q 50 45 85 15"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="8"
                  strokeLinecap="round"
                  filter="drop-shadow(0 0 14px #0284c7)"
                />
              </svg>
              {/* Shattered Rock Debris bursting from Golem */}
              <div className="absolute top-4 -left-6 text-xl animate-debris-l">🪨</div>
              <div className="absolute top-8 right-4 text-xl animate-debris-r">💥</div>
              <div className="absolute -top-2 right-8 text-lg animate-debris-r">🪨</div>
              <div className="animate-float-up text-amber-300 font-mono font-black text-xl drop-shadow-xl -mt-6 whitespace-nowrap">
                💥 ¡GOLPE DIRECTO AL GUARDIÁN -25 HP!
              </div>
            </div>
          )}

          {isCorrect === false && (
            <div className="absolute left-16 top-1/2 -translate-y-1/2 pointer-events-none z-35 flex flex-col items-center">
              <div className="text-2xl animate-bounce">⚡</div>
              <div className="animate-float-up text-rose-300 font-mono font-black text-base drop-shadow-lg whitespace-nowrap">
                💥 ¡EL GUARDIÁN TE GOLPEA! -20 HP
              </div>
            </div>
          )}

          {/* ENEMY ROCK GUARDIAN: CHARGES ACROSS TO SLAM HERO ON WRONG ANSWER */}
          <div
            className={`flex flex-col items-center relative transition-all ${
              isCorrect === false
                ? 'animate-golem-charge z-40'
                : isCorrect === true
                ? 'animate-hit-shake'
                : 'animate-breathe'
            }`}
          >
            {/* Floating Left & Right Boulder Fists with Smash Trajectory */}
            <div
              className={`absolute -left-8 top-6 w-7 h-7 bg-amber-800 border-2 border-amber-600 rounded-lg shadow-md ${
                isCorrect === false ? 'translate-x-6 translate-y-8 scale-125' : 'animate-bob'
              }`}
            />
            <div
              className={`absolute -right-8 top-6 w-7 h-7 bg-amber-800 border-2 border-amber-600 rounded-lg shadow-md ${
                isCorrect === false ? '-translate-x-6 translate-y-8 scale-125' : 'animate-bob'
              }`}
            />

            {/* Rocky Horns */}
            <div className="flex justify-between w-14 -mb-2 z-10">
              <div className="w-3.5 h-6 bg-amber-700 -rotate-12 rounded-t shadow" />
              <div className="w-3.5 h-6 bg-amber-700 rotate-12 rounded-t shadow" />
            </div>

            {/* Rock Golem Head */}
            <div className={`w-16 h-16 bg-slate-700 border-4 rounded-2xl flex items-center justify-around px-2 shadow-2xl relative ${isCorrect === true ? 'border-rose-500 bg-rose-950/80' : 'border-amber-600'}`}>
              {/* Glowing Red Crystal Eyes */}
              <div className="w-3.5 h-3.5 bg-red-500 rounded-full shadow-[0_0_12px_#ef4444] animate-pulse" />
              <div className="w-3.5 h-3.5 bg-red-500 rounded-full shadow-[0_0_12px_#ef4444] animate-pulse" />
            </div>

            {/* Heavy Golem Torso with Magma Core */}
            <div className="w-20 h-16 bg-slate-800 border-4 border-slate-600 rounded-2xl -mt-1 shadow-lg flex items-center justify-center text-amber-500 text-lg relative">
              <div className="w-5 h-5 rounded-full bg-amber-500/80 shadow-[0_0_10px_#f59e0b] animate-pulse" />
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pb-1">
          ¡Resuelve la resta para lanzar un ataque cuerpo a cuerpo real contra el Guardián!
        </div>

        {/* Win/Loss Status Overlay */}
        <OutcomeOverlay gameWon={gameWon} gameOver={gameOver} gameMode={gameMode} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // 4. WORLD 3: CIUDAD — Mercado del Mercader (Operaciones Reales de Tienda)
  // -------------------------------------------------------------
  if (gameMode === 'shop') {
    const shopData = activeQuestion?.contextData;
    const shopItems = shopData?.shopItems || [
      { name: 'Manzanas Crujientes', icon: '🍎', unitPrice: 2, quantity: 3 },
    ];
    const firstItem = shopItems[0];
    const totalCost = shopData?.totalCost || (firstItem ? firstItem.unitPrice * firstItem.quantity : 6);
    const isChangeProblem = !!shopData?.paidWith;

    return (
      <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] short:h-[46dvh] overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-[#3b0764] via-[#1e1b4b] to-[#0f172a] shadow-2xl select-none flex flex-col justify-between p-3 sm:p-4">
        {/* Marketplace Banner */}
        <div className="flex items-center justify-between bg-slate-900/85 backdrop-blur-md px-3 sm:px-4 py-2 rounded-xl border border-purple-500/40 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <div>
              <h4 className="text-xs font-bold text-purple-300 font-['Baloo_2']">
                Mercado de Don Mateo — Tienda Operativa Real
              </h4>
              <p className="text-[10px] text-slate-400">
                {isChangeProblem
                  ? 'Calcula el cambio exacto que te sobra al pagar'
                  : shopData?.operationKind === 'addition_combine'
                  ? 'Suma los precios de los productos variados del carrito'
                  : 'Multiplica precio unitario × cantidad para compras idénticas'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/40 px-2.5 py-1 rounded-full text-xs font-bold text-purple-200">
              <span>🧺 Cesta:</span>
              <span className="font-mono text-white">{shopCartTotal || questionIndex} compras</span>
            </div>
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-mono font-bold text-amber-400 shadow-sm">
              <span>🪙 Tu Dinero:</span>
              <span>${100 - questionIndex * 5}</span>
            </div>
          </div>
        </div>

        {/* MARKET STALL SCENE: PHYSICAL BASKET, CASH REGISTER & REAL TRANSACTION */}
        <div className="relative flex items-center justify-around h-56 max-w-xl mx-auto w-full">
          {/* PLAYER / CUSTOMER'S WICKER SHOPPING BASKET */}
          <div className="flex flex-col items-center z-20">
            <div className="bg-slate-900/80 border border-purple-400/40 px-2 py-0.5 rounded-full text-[9px] font-bold text-purple-300 mb-1">
              Tu Cesta de Compras
            </div>
            <div className="w-16 h-14 bg-gradient-to-b from-amber-700 to-amber-900 rounded-b-2xl border-2 border-amber-500 shadow-xl relative flex items-center justify-center">
              {/* Basket Weave Lines */}
              <div className="w-12 h-1 bg-amber-600 rounded-full" />
              {/* Items currently in basket */}
              <div className="absolute -top-3 flex gap-0.5">
                <span className="text-sm">🍎</span>
                {(shopCartTotal || questionIndex) > 0 && <span className="text-sm">🥖</span>}
                {(shopCartTotal || questionIndex) > 1 && <span className="text-sm">🧪</span>}
                {(shopCartTotal || questionIndex) > 2 && <span className="text-sm">🍪</span>}
              </div>
            </div>
            <div className="w-12 h-4 border-t-2 border-amber-400 rounded-t-full -mt-14 pointer-events-none" />

            {/* If paying cash, show coins held in buyer's hand */}
            {isChangeProblem && (
              <div className="mt-1.5 bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-300 flex items-center gap-1">
                <span>💵 Pagas: ${shopData?.paidWith}</span>
              </div>
            )}
          </div>

          {/* ACTIVE DROPPING PURCHASE & FLYING COIN CASCADE */}
          {isCorrect === true && (
            <div className="absolute left-1/2 top-1/4 -translate-x-1/2 pointer-events-none z-35 flex flex-col items-center">
              {/* Product Dropping into basket */}
              <div className="animate-basket-drop text-2xl -ml-24">
                {firstItem?.icon || '🛍️'}
              </div>
              {/* Gold Coins Flying to Don Mateo */}
              <div className="animate-coin-fly flex items-center gap-1 ml-20">
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 border-2 border-white shadow-[0_0_15px_#f59e0b] flex items-center justify-center text-slate-900 font-black text-xs font-mono">
                  🪙
                </div>
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 border border-white shadow-[0_0_10px_#f59e0b] flex items-center justify-center text-slate-900 text-[10px] font-mono">
                  🪙
                </div>
              </div>
              <div className="animate-float-up bg-slate-900/90 border border-amber-400 text-amber-300 font-bold text-xs px-3 py-1 rounded-full shadow-lg mt-2 whitespace-nowrap">
                🛎️ ¡Cuenta exacta! {isChangeProblem ? `Cambio de $${shopData?.changeDue} devuelto` : '¡Empacado en tu cesta!'}
              </div>
            </div>
          )}

          {isCorrect === false && (
            <div className="absolute left-1/2 top-1/3 -translate-x-1/2 pointer-events-none z-35 flex flex-col items-center">
              <div className="animate-float-up bg-slate-900/95 border border-rose-500 text-rose-300 font-bold text-xs px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                ❌ Don Mateo: "¡Ese cálculo no cuadra con la caja!"
              </div>
            </div>
          )}

          {/* Shopkeeper (Don Mateo) behind counter */}
          <div className={`flex flex-col items-center transition-all ${isCorrect === true ? 'animate-bob scale-110 -translate-y-2' : isCorrect === false ? 'rotate-6' : 'animate-breathe'}`}>
            {/* Chef/Merchant Hat */}
            <div className="w-10 h-6 bg-white rounded-t-full border border-slate-300 shadow-sm" />
            <div className="w-12 h-12 rounded-full bg-[#fed7aa] border-2 border-slate-700 flex flex-col items-center justify-center relative shadow-md">
              <div className="flex gap-2.5">
                <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
              </div>
              {/* Mustache */}
              <div className="w-6 h-1.5 bg-amber-950 rounded-full mt-1 shadow-sm" />
              {isCorrect === true ? (
                <div className="w-4 h-1.5 border-b-2 border-rose-600 rounded-full mt-0.5" />
              ) : isCorrect === false ? (
                <div className="w-3 h-1 bg-red-800 rounded-full mt-1" />
              ) : null}
            </div>
            {/* Vest & Apron */}
            <div className="w-12 h-14 bg-purple-700 rounded-xl border-2 border-purple-400 shadow-md flex items-center justify-center text-white text-xs font-bold relative">
              <span className="text-sm">🪙</span>
              {/* Hands raised in celebration or crossing arms */}
              <div className={`absolute -left-2.5 w-3 h-3 bg-[#fed7aa] rounded-full shadow transition-all ${isCorrect === true ? '-top-1' : isCorrect === false ? 'top-6' : 'top-4'}`} />
              <div className={`absolute -right-2.5 w-3 h-3 bg-[#fed7aa] rounded-full shadow transition-all ${isCorrect === true ? '-top-1' : isCorrect === false ? 'top-6' : 'top-4'}`} />
            </div>
            <span className="text-[10px] font-bold text-purple-300 mt-1">Don Mateo</span>
          </div>

          {/* Wooden Counter with Shelves and Products Active in this Transaction */}
          <div className="flex flex-col items-center">
            {/* Striped Awning */}
            <div
              className="w-52 sm:w-60 h-8 rounded-t-lg shadow-md border-b-2 border-amber-400"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, #8b5cf6 0 18px, #f59e0b 18px 36px)',
              }}
            />

            {/* Counter Shelf showing the real items being purchased right now */}
            <div className="w-52 sm:w-60 bg-[#78350f] border-2 border-[#b45309] rounded-b-xl p-2 shadow-2xl flex justify-around items-center">
              {shopItems.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center bg-slate-900/85 p-1.5 rounded-lg border border-amber-500/40 shadow"
                >
                  <span className="text-lg animate-breathe">{item.icon}</span>
                  <span className="text-[8px] font-mono text-amber-300 font-bold">
                    {item.quantity > 1 ? `${item.quantity}×$${item.unitPrice}` : `$${item.unitPrice}`}
                  </span>
                </div>
              ))}
              {isChangeProblem && (
                <div className="flex flex-col items-center bg-amber-950/80 p-1.5 rounded-lg border border-amber-400/60 shadow">
                  <span className="text-lg">🧾</span>
                  <span className="text-[8px] font-mono text-amber-300 font-bold">
                    Total: ${shopData?.totalCost}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Commercial & Pedagogical Context Bar */}
        <div className="bg-slate-900/85 backdrop-blur-sm border border-purple-500/30 px-3.5 py-2 rounded-xl flex flex-col sm:flex-row items-center justify-between text-xs text-purple-200 gap-1.5 shadow-md">
          <div className="flex items-center gap-1.5 text-center sm:text-left">
            <span>🛒</span>
            <span className="font-bold text-white">Operación en Mostrador:</span>
            <span className="text-purple-300">
              {shopItems.map((it) => `${it.quantity > 1 ? `${it.quantity}× ` : ''}${it.name}`).join(' + ')}
            </span>
          </div>
          <div className="font-mono text-amber-300 font-bold text-[11px] bg-purple-950/50 px-2.5 py-0.5 rounded border border-purple-500/40">
            {shopData?.operationKind === 'multiplication_groups'
              ? 'Multiplicamos: Grupos Iguales'
              : shopData?.operationKind === 'addition_combine'
              ? 'Sumamos: Artículos Distintos'
              : shopData?.operationKind === 'subtraction_change'
              ? 'Restamos: Calcular Cambio'
              : 'Razonamiento Matemático'}
          </div>
        </div>

        {/* Win/Loss Status Overlay */}
        <OutcomeOverlay gameWon={gameWon} gameOver={gameOver} gameMode={gameMode} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // 5. WORLD 4: RÍO — Puente Flotante (División)
  // -------------------------------------------------------------
  if (gameMode === 'bridge') {
    const totalSegs = totalQuestions || 5;

    return (
      <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] short:h-[46dvh] overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-[#0284c7]/30 via-[#0f172a] to-[#022c44] shadow-2xl select-none flex flex-col justify-between p-4">
        {/* River Progress Banner */}
        <div className="flex items-center justify-between bg-slate-900/85 backdrop-blur-md px-4 py-2 rounded-xl border border-sky-500/40 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌉</span>
            <div>
              <h4 className="text-xs font-bold text-sky-300 font-['Baloo_2']">
                Puente de {currentRegion.name} — 3º Grado
              </h4>
              <p className="text-[10px] text-slate-400">
                Tramos construidos: {bridgeBuiltSegments} de {totalSegs} pilares
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-sky-300 font-bold bg-sky-500/10 px-3 py-1 rounded-full border border-sky-500/40 shadow-sm">
            {Math.round((bridgeBuiltSegments / totalSegs) * 100)}% Completado
          </div>
        </div>

        {/* RIVER GORGE: REAL PIERS AND CONNECTED BRIDGE SPANS */}
        <div className="relative flex items-center justify-center h-52 w-full max-w-xl mx-auto">
          {/* Left Cliff (Orilla Campamento) */}
          <div className="absolute left-0 bottom-4 w-20 sm:w-24 h-36 bg-[#334155] border-t-4 border-[#64748b] rounded-tr-2xl shadow-xl flex flex-col items-center justify-between py-2 text-xs text-slate-300 z-10">
            <span className="font-bold text-[10px]">Campamento</span>
            <div className="text-lg">🏕️</div>
          </div>

          {/* Right Cliff (Orilla Templo) */}
          <div className="absolute right-0 bottom-4 w-20 sm:w-24 h-36 bg-[#334155] border-t-4 border-[#64748b] rounded-tl-2xl shadow-xl flex flex-col items-center justify-between py-2 text-xs text-slate-300 z-10">
            <span className="font-bold text-[10px]">Templo</span>
            <div className="text-lg">🏰</div>
          </div>

          {/* Rushing River Water with Rapids & Splashes */}
          <div className="absolute inset-x-16 bottom-0 h-20 bg-gradient-to-t from-[#024970] via-[#0369a1] to-[#38bdf8]/80 rounded-b-xl overflow-hidden flex flex-col justify-end">
            <div className="absolute bottom-6 left-1/4 text-sm animate-bounce opacity-80 pointer-events-none">
              🐟
            </div>
            {/* Water splash ring on dropped timber */}
            {isCorrect === false && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-6 border-2 border-white/80 rounded-full animate-splash-ring pointer-events-none" />
            )}
            <div className="w-full h-8 flex items-center justify-around opacity-60 animate-water-flow">
              <div className="w-24 h-1.5 bg-white/60 rounded-full blur-[0.5px]" />
              <div className="w-16 h-1 bg-white/40 rounded-full blur-[0.5px]" />
              <div className="w-32 h-1.5 bg-white/60 rounded-full blur-[0.5px]" />
            </div>
          </div>

          {/* 5 REAL STRUCTURAL STONE PIERS & HEAVY TIMBER BRIDGE SPANS */}
          <div className="relative z-10 flex gap-1.5 items-end w-64 sm:w-80 justify-between h-28 pb-4">
            {Array.from({ length: totalSegs }).map((_, idx) => {
              const isBuilt = idx < bridgeBuiltSegments;
              const isLatest = idx === bridgeBuiltSegments - 1 && isCorrect === true;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
                  {/* Timber Bridge Deck Span */}
                  <div
                    className={`w-full h-4 rounded border transition-all duration-500 relative flex items-center justify-center ${
                      isBuilt
                        ? 'bg-gradient-to-r from-[#b45309] via-[#d97706] to-[#b45309] border-amber-300 shadow-md'
                        : 'border-dashed border-slate-600 bg-slate-800/40'
                    } ${isLatest ? 'animate-span-connect' : ''}`}
                  >
                    {isBuilt ? (
                      <div className="w-full h-0.5 bg-amber-200/50" />
                    ) : (
                      <span className="text-[8px] text-slate-500 font-mono">{idx + 1}</span>
                    )}
                  </div>

                  {/* Stone Pillar Pier rising from riverbed */}
                  <div
                    className={`w-4 h-14 rounded-t border-x-2 transition-all duration-500 ${
                      isBuilt
                        ? 'bg-slate-500 border-slate-400 shadow-inner'
                        : 'bg-slate-700/60 border-slate-600'
                    } ${isLatest ? 'animate-pier-rise' : ''}`}
                  />
                </div>
              );
            })}
          </div>

          {/* EXPLORER CHARACTER: PHYSICALLY STANDS ON THE FURTHEST BUILT SPAN */}
          <div
            className={`absolute z-20 transition-all duration-500 ease-out flex flex-col items-center ${
              isCorrect === true
                ? 'animate-hero-leap'
                : isCorrect === false
                ? 'animate-hit-shake'
                : 'animate-breathe'
            }`}
            style={{
              left: `${18 + (bridgeBuiltSegments / totalSegs) * 60}%`,
              bottom: '56px',
            }}
          >
            {isCorrect === true && (
              <div className="absolute -top-8 text-xs font-mono font-black text-amber-300 animate-float-up whitespace-nowrap">
                ¡Tramo construido! Paso firme 👣
              </div>
            )}
            {isCorrect === false && (
              <div className="absolute -top-8 text-xs font-mono font-black text-rose-400 animate-float-up whitespace-nowrap">
                ⚠️ ¡Cuidado con el abismo!
              </div>
            )}

            <div className="w-8 h-8 rounded-full bg-[#fed7aa] border-2 border-slate-700 flex items-center justify-center shadow-md">
              <span className="text-[12px]">{isCorrect === true ? '🤩' : isCorrect === false ? '😨' : '🤠'}</span>
            </div>
            <div className="w-7 h-9 bg-sky-600 rounded-lg -mt-0.5 border border-sky-300 shadow flex items-center justify-center text-[9px] font-bold text-white">
              3º
            </div>
            <div className="flex gap-1 -mt-0.5">
              <div className="w-2.5 h-3 bg-amber-800 rounded-b" />
              <div className="w-2.5 h-3 bg-amber-800 rounded-b" />
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pb-1">
          ¡Cada división exacta coloca un tramo de puente real para que tu explorador cruce el cañón!
        </div>

        {/* Win/Loss Status Overlay */}
        <OutcomeOverlay gameWon={gameWon} gameOver={gameOver} gameMode={gameMode} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // 6. WORLD 5: CASTILLO — Enigma del Portón Mecánico
  // -------------------------------------------------------------
  const unlockedCount = cluesFound || questionIndex + (isCorrect ? 1 : 0);

  return (
    <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] short:h-[46dvh] overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-[#500724] via-[#1e142b] to-[#0f172a] shadow-2xl select-none flex flex-col justify-between p-4">
      {/* Citadel Banner */}
      <div className="flex items-center justify-between bg-slate-900/85 backdrop-blur-md px-4 py-2 rounded-xl border border-pink-500/40 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏰</span>
          <div>
            <h4 className="text-xs font-bold text-pink-300 font-['Baloo_2']">
              Gran Portón Acorazado del Castillo — 3º Grado
            </h4>
            <p className="text-[10px] text-slate-400">Desbloquea los 5 cerrojos mecánicos resolviendo los enigmas</p>
          </div>
        </div>
        <div className="text-xs font-mono text-pink-300 font-bold bg-pink-500/10 px-3 py-1 rounded-full border border-pink-500/40 shadow-sm">
          Cerrojos: {Math.min(unlockedCount, 5)} / 5
        </div>
      </div>

      {/* CASTLE VAULT ENTRANCE WITH MECHANICAL BOLTS AND REAL BEAM */}
      <div className="relative flex items-center justify-center h-56 max-w-xl mx-auto w-full">
        {/* Magical Beam from Detective to Active Lock */}
        {isCorrect === true && (
          <div className="absolute left-16 top-1/2 w-48 h-2 bg-gradient-to-r from-amber-400 via-pink-400 to-white shadow-[0_0_15px_#fbbf24] animate-unlock-beam z-30 pointer-events-none rounded-full" />
        )}

        {/* GREAT GOTHIC ARCH & VAULT DOORS */}
        <div className="flex flex-col items-center relative z-10">
          {/* Gothic Arch Peak */}
          <div className="w-56 h-12 border-t-8 border-x-8 border-slate-600 rounded-t-full bg-slate-900/90 flex items-center justify-center">
            <span className="text-amber-400 text-xs font-mono font-bold tracking-wider">ᚱᚢᚾᚨ ᛗᚨᚷᛁᚲᚨ</span>
          </div>

          {/* Double Iron-Banded Vault Doors */}
          <div className="w-56 h-36 bg-[#2d1b4e] border-4 border-slate-600 rounded-b-lg shadow-2xl relative flex overflow-hidden">
            {/* Left Door Half */}
            <div className={`w-1/2 h-full border-r-2 border-slate-800 bg-gradient-to-r from-[#1e142b] to-[#3b1d5c] flex flex-col justify-around px-2 ${unlockedCount >= 5 ? 'animate-gate-left' : ''}`}>
              <div className="w-full h-1 bg-amber-500/30 rounded-full" />
              <div className="w-full h-1 bg-amber-500/30 rounded-full" />
            </div>

            {/* Right Door Half */}
            <div className={`w-1/2 h-full border-l-2 border-slate-800 bg-gradient-to-l from-[#1e142b] to-[#3b1d5c] flex flex-col justify-around px-2 ${unlockedCount >= 5 ? 'animate-gate-right' : ''}`}>
              <div className="w-full h-1 bg-amber-500/30 rounded-full" />
              <div className="w-full h-1 bg-amber-500/30 rounded-full" />
            </div>

            {/* Glowing Golden Treasure inside if fully unlocked */}
            {unlockedCount >= 5 && (
              <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center text-4xl animate-pulse z-5">
                🏆
              </div>
            )}

            {/* 5 HORIZONTAL CROSS-BOLTS ACROSS THE VAULT DOORS */}
            <div className="absolute inset-y-2 inset-x-4 flex flex-col justify-between z-20">
              {Array.from({ length: 5 }).map((_, idx) => {
                const isBoltUnlocked = idx < unlockedCount;
                const isCurrent = idx === questionIndex;

                return (
                  <div
                    key={idx}
                    className={`h-4.5 rounded border flex items-center justify-between px-2 text-[8px] font-mono transition-all duration-500 ${
                      isBoltUnlocked
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_10px_#10b981] translate-x-12 opacity-40'
                        : isCurrent
                        ? isCorrect === false
                          ? 'bg-rose-950 border-rose-500 text-rose-300 animate-lock-jam'
                          : 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-[0_0_8px_#f59e0b]'
                        : 'bg-slate-900/90 border-slate-600 text-slate-400'
                    }`}
                  >
                    <span>{isBoltUnlocked ? '🔓 ABIERTO' : `🔒 CERROJO #${idx + 1}`}</span>
                    <span>{isBoltUnlocked ? '✓' : isCurrent ? '⚡' : 'ᚷ'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* DETECTIVE CHARACTER AIMING CIPHER WAND */}
        <div className="absolute left-6 bottom-4 flex flex-col items-center z-20 pointer-events-none">
          {isCorrect === true && (
            <div className="absolute -top-7 animate-float-up text-[10px] font-bold font-mono text-pink-300 bg-slate-900/90 border border-pink-500 px-2 py-0.5 rounded-full shadow whitespace-nowrap">
              🔓 ¡Cerrojo abierto!
            </div>
          )}
          {isCorrect === false && (
            <div className="absolute -top-7 animate-float-up text-[10px] font-bold font-mono text-rose-400 bg-slate-900/90 border border-rose-500 px-2 py-0.5 rounded-full shadow whitespace-nowrap">
              ⚡ ¡El cerrojo resiste!
            </div>
          )}

          <div className="w-8 h-8 rounded-full bg-[#fed7aa] border-2 border-slate-700 flex items-center justify-center text-sm shadow">
            🕵️
          </div>
          <div className="w-7 h-10 bg-amber-800 rounded-md border border-amber-600 shadow flex items-center justify-center text-amber-200 text-xs relative">
            <span className="text-sm">🪄</span>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 pb-1">
        ¡Resuelve el enigma para que el detective dispare el rayo descifrador y abra los 5 cerrojos del portón!
      </div>

      {/* Win/Loss Status Overlay */}
      <OutcomeOverlay gameWon={gameWon} gameOver={gameOver} gameMode={gameMode} />
    </div>
  );
};
