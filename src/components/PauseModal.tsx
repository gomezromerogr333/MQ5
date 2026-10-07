import React from 'react';
import { PlayCircle, Compass } from 'lucide-react';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onGoToMap: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ isOpen, onResume, onGoToMap }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 m-auto rounded-3xl w-full max-w-sm p-6 sm:p-8 text-center shadow-2xl text-slate-100 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-30 bg-amber-500" />

        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-slate-800 border border-slate-700 shadow-inner">
          ⏸️
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold font-['Baloo_2'] text-white">Juego en pausa</h2>
        <p className="text-sm text-slate-400 mt-1 mb-6">El tiempo está detenido. Nadie está perdiendo vidas ahora.</p>

        <div className="space-y-2.5">
          <button
            onClick={onResume}
            autoFocus
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
          >
            <PlayCircle className="w-5 h-5" />
            <span>Continuar jugando</span>
          </button>

          <button
            onClick={onGoToMap}
            className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <Compass className="w-4 h-4" />
            <span>Salir al mapa de las 4 regiones</span>
          </button>
        </div>
      </div>
    </div>
  );
};
