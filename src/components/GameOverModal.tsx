import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Compass, Loader2, AlertTriangle } from 'lucide-react';
import { LevelDisplayInfo } from '../types';

interface GameOverModalProps {
  isOpen: boolean;
  isWon: boolean;
  score: number;
  xpGained: number;
  submitState: 'submitting' | 'error' | 'done';
  submitErrorMessage?: string | null;
  correctCount: number;
  totalCount: number;
  currentLevel: LevelDisplayInfo;
  onReplay: () => void;
  onGoToMap: () => void;
  onNextLevel?: () => void;
  /** Si viene, esta victoria completó el universo: ofrece ver el Gran Final (lleva al mapa). */
  onShowFinale?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  isWon,
  score,
  xpGained,
  submitState,
  submitErrorMessage,
  correctCount,
  totalCount,
  currentLevel,
  onReplay,
  onGoToMap,
  onNextLevel,
  onShowFinale,
}) => {
  useEffect(() => {
    if (isOpen && isWon) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3FA34D', '#F2B705', '#8B5CF6', '#38BDF8'],
        });
      } catch {
        // Fallback safely if confetti cannot mount
      }
    }
  }, [isOpen, isWon]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 m-auto rounded-3xl w-full max-w-md p-6 sm:p-8 text-center shadow-2xl text-slate-100 relative overflow-hidden">
        {/* Glow backdrop */}
        <div
          className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-30 ${
            isWon ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />

        {/* Icon & Title */}
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-slate-800 border border-slate-700 shadow-inner">
          {isWon ? '🏆' : '💔'}
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold font-['Baloo_2'] text-white">
          {isWon ? `¡${currentLevel.shortName} Superado!` : '¡Sin vidas!'}
        </h2>

        <p className="text-sm text-slate-400 mt-1 mb-6">
          {isWon
            ? '¡Excelente cálculo mental! Has completado este nivel con éxito.'
            : 'Los errores son parte del aprendizaje. ¡Vuelve a intentarlo y supéralo!'}
        </p>

        {/* Stats card */}
        <div className="grid grid-cols-3 gap-2.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 mb-6">
          <div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {correctCount}/{totalCount}
            </div>
            <div className="text-[11px] text-slate-400">Correctas</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-400">{score}</div>
            <div className="text-[11px] text-slate-400">Puntaje</div>
          </div>
          <div>
            {submitState === 'submitting' ? (
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              </div>
            ) : submitState === 'error' ? (
              <div className="text-xl font-bold font-mono text-rose-400">--</div>
            ) : (
              <div className="text-xl font-bold font-mono text-blue-400">+{xpGained}</div>
            )}
            <div className="text-[11px] text-slate-400">XP Ganado</div>
          </div>
        </div>

        {submitState === 'error' && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs text-left flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              No pudimos guardar este resultado en el servidor{submitErrorMessage ? `: ${submitErrorMessage}` : '.'} Revisa tu
              conexión; si vuelve a pasar, avísale a tu docente.
            </span>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2.5">
          {isWon && onShowFinale && (
            <button
              onClick={onShowFinale}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-200 text-slate-900 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(251,191,36,0.45)] transition-colors"
            >
              <span aria-hidden="true">👑</span>
              <span>¡Ver el Gran Final!</span>
            </button>
          )}

          {isWon && onNextLevel && (
            <button
              onClick={onNextLevel}
              disabled={submitState === 'submitting'}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
            >
              {submitState === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando progreso...</span>
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4" />
                  <span>Siguiente nivel</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onReplay}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Jugar de nuevo este nivel</span>
          </button>

          <button
            onClick={onGoToMap}
            className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <Compass className="w-4 h-4" />
            <span>Volver al mapa de las 4 regiones</span>
          </button>
        </div>
      </div>
    </div>
  );
};
