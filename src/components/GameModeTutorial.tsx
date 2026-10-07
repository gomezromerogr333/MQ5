import React from 'react';
import { PlayCircle } from 'lucide-react';
import { GameMode } from '../types';

interface TutorialContent {
  icon: string;
  title: string;
  body: string;
}

// Una explicación corta y concreta por tipo de juego (igual en las 4 regiones,
// el juego se siente igual sin importar la operación). Ver principio "cero
// confusión" en docs/DECISIONS.md / Master Role del proyecto.
const TUTORIAL_CONTENT: Record<GameMode, TutorialContent> = {
  race: {
    icon: '🏃',
    title: 'Carrera Matemática',
    body: 'Responde rápido y bien para que tu personaje avance por la pista. Si fallas, retrocedes un poco. ¡El que más avanza, gana la carrera!',
  },
  battle: {
    icon: '⚔️',
    title: 'Batalla Matemática',
    body: 'Cada respuesta correcta es un golpe al enemigo. Si fallas, el enemigo te golpea a ti. ¡Derríbalo antes de quedarte sin vidas!',
  },
  bridge: {
    icon: '🌉',
    title: 'Construye el Puente',
    body: 'Cada acierto coloca un bloque nuevo del puente. ¡Completa todos los bloques para cruzar al otro lado!',
  },
  shop: {
    icon: '🛒',
    title: 'Tienda Matemática',
    body: 'Ayuda a la tienda a hacer bien las cuentas de cada compra. ¡Resuelve correcto para llenar la canasta!',
  },
  detective: {
    icon: '🕵️',
    title: 'Detective Matemático',
    body: 'En esta operación falta un número. Mira las pistas y elige, entre las opciones, el número secreto que falta.',
  },
};

interface GameModeTutorialProps {
  gameMode: GameMode | null;
  onDismiss: () => void;
}

export const GameModeTutorial: React.FC<GameModeTutorialProps> = ({ gameMode, onDismiss }) => {
  if (!gameMode) return null;
  const content = TUTORIAL_CONTENT[gameMode];

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 m-auto rounded-3xl w-full max-w-md p-6 sm:p-8 text-center shadow-2xl text-slate-100 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-30 bg-sky-500" />

        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-slate-800 border border-slate-700 shadow-inner">
          {content.icon}
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-300 mb-1">Nuevo juego</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold font-['Baloo_2'] text-white">{content.title}</h2>

        <p className="text-sm text-slate-300 mt-3 mb-6 leading-relaxed">{content.body}</p>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-800/70 border border-slate-700/70 rounded-xl px-3 py-2.5 mb-6">
          <span>⏱️ Tienes tiempo limitado</span>
          <span className="text-slate-600">·</span>
          <span>❤️ Vidas limitadas</span>
          <span className="text-slate-600">·</span>
          <span>Míralas arriba</span>
        </div>

        <button
          onClick={onDismiss}
          autoFocus
          className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
        >
          <PlayCircle className="w-5 h-5" />
          <span>¡Entendido, a jugar!</span>
        </button>
      </div>
    </div>
  );
};
