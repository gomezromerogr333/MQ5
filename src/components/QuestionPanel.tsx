import React from 'react';
import { MathQuestion } from '../types';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  Receipt,
  Coins,
  Repeat,
  PlusCircle,
  MinusCircle,
  HelpCircle,
} from 'lucide-react';

interface QuestionPanelProps {
  question: MathQuestion | null;
  timeLeft: number;
  maxTime: number;
  isAnswered: boolean;
  selectedOption: number | string | null;
  isCorrect: boolean | null;
  combo: number;
  feedbackText: string;
  onSelectOption: (option: number | string) => void;
  gameMode: string;
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  timeLeft,
  maxTime,
  isAnswered,
  selectedOption,
  isCorrect,
  combo,
  feedbackText,
  onSelectOption,
  gameMode,
}) => {
  if (!question) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        Cargando desafío matemático...
      </div>
    );
  }

  const timePct = Math.max(0, (timeLeft / maxTime) * 100);
  const timerColor =
    timePct > 50
      ? 'bg-emerald-500'
      : timePct > 22
      ? 'bg-amber-400'
      : 'bg-rose-500 animate-pulse';

  const isShopMode = gameMode === 'shop';
  const shopData = question.contextData;
  // Nuestras opciones son siempre numéricas (banco de Supabase), así que este
  // diseño de "opciones de texto largo" no aplica hoy; queda listo por si en el
  // futuro se agregan preguntas de opción de texto.
  const hasLongTextOptions = false;

  // Helper badge for why we operate
  const getOperationBadge = () => {
    if (!shopData?.operationKind && !isShopMode) return null;

    switch (shopData?.operationKind) {
      case 'multiplication_groups':
        return (
          <div className="flex items-center gap-1.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs px-3 py-1 rounded-full font-medium">
            <Repeat className="w-3.5 h-3.5 text-purple-400" />
            <span>Multiplicar: Grupos Iguales</span>
          </div>
        );
      case 'addition_combine':
        return (
          <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs px-3 py-1 rounded-full font-medium">
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sumar: Juntar Artículos Distintos</span>
          </div>
        );
      case 'subtraction_change':
        return (
          <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-3 py-1 rounded-full font-medium">
            <MinusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Restar: Calcular Vuelto / Cambio</span>
          </div>
        );
      case 'concept_reason':
        return (
          <div className="flex items-center gap-1.5 bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs px-3 py-1 rounded-full font-medium">
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Razonamiento: ¿Por qué operamos?</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800/80 rounded-2xl p-3 sm:p-6 short:p-2 tight:p-2 shadow-xl backdrop-blur-md flex flex-col items-center text-center relative overflow-clip">
      {/* Top Metadata Badges */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-2 short:mb-1 short:gap-1">
        <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full">
          <Sparkles className="w-3.5 h-3.5" />
          {question.category}
        </span>

        {getOperationBadge()}

        <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-700">
          {question.difficulty > 3 ? 'Reto avanzado' : `Nivel ${question.difficulty}`} · 3º Grado
        </span>

        {combo >= 2 && (
          <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
            🔥 Combo x{Math.min(combo, 4)} (+{Math.min(combo, 4) * 5} pts)
          </span>
        )}
      </div>

      {/* OPERATIONAL SHOP RECEIPT (When in Shop Mode) */}
      {isShopMode && shopData && (
        <div className="w-full max-w-lg mb-3 bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-purple-950/40 border border-purple-500/30 rounded-xl p-3 sm:p-3.5 text-left shadow-inner">
          <div className="flex items-center justify-between pb-2 border-b border-purple-500/20 text-xs text-purple-200">
            <div className="flex items-center gap-1.5 font-bold">
              <Receipt className="w-4 h-4 text-purple-400" />
              <span>Ticket de Compra de Don Mateo</span>
            </div>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-900/40 px-2 py-0.5 rounded border border-purple-500/30">
              OPERACIÓN REAL
            </span>
          </div>

          {/* List of items in cart */}
          {shopData.shopItems && shopData.shopItems.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {shopData.shopItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <span className="font-semibold text-slate-200">{item.name}</span>
                    {item.quantity > 1 ? (
                      <span className="bg-purple-500/20 text-purple-300 font-mono text-[11px] px-1.5 py-0.2 rounded border border-purple-500/30">
                        {item.quantity} unidades × ${item.unitPrice} c/u
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-[11px]">
                        ${item.unitPrice}
                      </span>
                    )}
                  </div>
                  <div className="font-mono font-bold text-amber-300">
                    ${item.quantity * item.unitPrice}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cash & Change breakdown (if change question) */}
          {shopData.paidWith && shopData.totalCost && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-2">
                <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                  <Coins className="w-3 h-3" /> Dinero entregado:
                </span>
                <span className="font-mono text-sm font-bold text-amber-200">
                  ${shopData.paidWith} en efectivo
                </span>
              </div>
              <div className="bg-purple-950/30 border border-purple-500/30 rounded-lg p-2">
                <span className="text-[10px] text-purple-300 font-semibold flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3" /> Costo total:
                </span>
                <span className="font-mono text-sm font-bold text-purple-200">
                  ${shopData.totalCost} a pagar
                </span>
              </div>
            </div>
          )}

          {/* Why we operate explanation teaser */}
          {shopData.whyOperation && (
            <div className="mt-2.5 pt-2 border-t border-purple-500/20 flex items-start gap-1.5 text-[11px] text-purple-200/90 leading-relaxed">
              <span className="font-bold text-amber-400 shrink-0">💡 ¿Por qué?:</span>
              <span>{shopData.whyOperation}</span>
            </div>
          )}
        </div>
      )}

      {/* Math Challenge Prompt */}
      <h2
        className={`font-extrabold tracking-tight text-white my-2 short:my-0.5 tight:my-1 drop-shadow-sm ${
          hasLongTextOptions
            ? 'text-lg sm:text-xl font-sans text-center max-w-xl'
            : 'text-2xl sm:text-3xl md:text-4xl short:text-xl font-mono'
        }`}
      >
        {question.text}
      </h2>

      {/* Timer Bar */}
      <div className="w-full max-w-md my-2 short:my-0.5 tight:my-1">
        <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono mb-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> Tiempo restante
          </span>
          <span className={timePct < 25 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
            {(timeLeft / 1000).toFixed(1)}s
          </span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/80">
          <div
            className={`h-full ${timerColor} transition-all duration-100 ease-linear rounded-full`}
            style={{ width: `${timePct}%` }}
          />
        </div>
      </div>

      {/* Interactive Answer Grid / Options */}
      <div
        className={`w-full max-w-xl mt-3 short:mt-1 tight:mt-1.5 ${
          hasLongTextOptions
            ? 'flex flex-col gap-2.5'
            : 'grid grid-cols-3 gap-2 sm:gap-3 max-w-lg max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:bg-slate-900 max-sm:py-1'
        }`}
      >
        {question.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          const isThisCorrect = isAnswered && option === question.correct;
          const isThisWrong = isAnswered && isSelected && !isCorrect;

          let btnStyles =
            'bg-slate-800/90 border-slate-700 text-slate-100 hover:border-purple-500/60 hover:bg-slate-750';

          if (isThisCorrect) {
            btnStyles =
              'bg-emerald-600/30 border-emerald-500 text-emerald-200 font-bold scale-[1.01] shadow-lg shadow-emerald-500/20';
          } else if (isThisWrong) {
            btnStyles =
              'bg-rose-600/30 border-rose-500 text-rose-200 font-bold scale-[0.99]';
          } else if (isAnswered) {
            btnStyles = 'bg-slate-800/40 border-slate-800 text-slate-500 opacity-60';
          }

          return (
            <button
              key={idx}
              id={`option-btn-${idx}`}
              disabled={isAnswered}
              onClick={() => onSelectOption(option)}
              className={`rounded-xl border-2 transition-all duration-150 flex items-center relative cursor-pointer active:scale-95 disabled:cursor-not-allowed ${
                hasLongTextOptions
                  ? 'p-3 text-left font-sans text-xs sm:text-sm font-semibold justify-start gap-2.5'
                  : 'p-3 sm:p-4 short:p-1.5 tight:p-2 justify-center font-mono text-xl sm:text-2xl font-bold'
              } ${btnStyles}`}
            >
              <span
                className={`flex items-center justify-center rounded-md font-sans text-xs font-bold shrink-0 ${
                  hasLongTextOptions
                    ? 'w-6 h-6 bg-slate-700/80 text-purple-300 border border-slate-600'
                    : 'absolute top-1 left-2 text-[10px] text-slate-500 font-normal'
                }`}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span className={hasLongTextOptions ? 'leading-snug' : ''}>
                {typeof option === 'number' && isShopMode ? `$${option}` : option}
              </span>
            </button>
          );
        })}
      </div>

      {/* Immediate Educational Feedback Banner */}
      <div
        className={`w-full max-w-xl mt-3.5 short:mt-1.5 p-3 sm:p-4 short:p-1.5 rounded-xl text-xs sm:text-sm short:text-[11px] transition-all flex items-start gap-2.5 text-left ${
          isAnswered
            ? isCorrect
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
            : 'bg-slate-800/40 border border-slate-800 text-slate-400 tight:hidden short:hidden'
        }`}
      >
        {isAnswered ? (
          isCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )
        ) : (
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        )}
        <div className="w-full">
          <p className="font-bold leading-tight">
            {feedbackText ||
              (question.hint
                ? `💡 Pista de Don Mateo: ${question.hint}`
                : 'Selecciona la respuesta correcta antes de que se agote el tiempo.')}
          </p>
          {isAnswered && (
            <div className="mt-1.5 text-[11.5px] text-slate-200 font-normal leading-relaxed border-t border-slate-700/40 pt-1.5">
              <span className="font-bold text-amber-300">💡 Explicación Operativa: </span>
              {question.explanation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

