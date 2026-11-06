import React, { useState, useEffect, useRef } from 'react';
import { Iteration, SolverResult } from '../lib/solvers';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Zap, Layers, Sparkles } from 'lucide-react';

interface StepByStepPlayerProps {
  newtonResult: SolverResult;
  secantResult: SolverResult;
  activeMethod: 'Newton-Raphson' | 'Secante';
  onSelectMethod: (method: 'Newton-Raphson' | 'Secante') => void;
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  T: number;
  mu: number;
}

export const StepByStepPlayer: React.FC<StepByStepPlayerProps> = ({
  newtonResult,
  secantResult,
  activeMethod,
  onSelectMethod,
  currentStepIndex,
  onStepChange,
  T,
  mu,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(800); // ms per step
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeHistory = activeMethod === 'Newton-Raphson' ? newtonResult.history : secantResult.history;
  const totalSteps = activeHistory.length;
  const currentIter: Iteration | undefined = activeHistory[currentStepIndex];

  const stepRef = useRef(currentStepIndex);
  stepRef.current = currentStepIndex;

  // Auto-player loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        const next = stepRef.current + 1;
        if (next < totalSteps) {
          onStepChange(next);
        } else {
          setIsPlaying(false);
        }
      }, playSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playSpeed, totalSteps, onStepChange]);

  const handlePrev = () => {
    setIsPlaying(false);
    if (currentStepIndex > 0) onStepChange(currentStepIndex - 1);
  };

  const handleNext = () => {
    setIsPlaying(false);
    if (currentStepIndex < totalSteps - 1) onStepChange(currentStepIndex + 1);
  };

  const handleReset = () => {
    setIsPlaying(false);
    onStepChange(0);
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Laboratorio Interactivo: Exploración Paso a Paso
          </h3>
          <p className="text-xs text-slate-400">
            Examina la toma de decisiones y el avance iterativo en tiempo real
          </p>
        </div>

        {/* Method Toggle */}
        <div className="inline-flex p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => {
              onSelectMethod('Newton-Raphson');
              onStepChange(0);
              setIsPlaying(false);
            }}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMethod === 'Newton-Raphson'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Newton-Raphson
          </button>
          <button
            onClick={() => {
              onSelectMethod('Secante');
              onStepChange(0);
              setIsPlaying(false);
            }}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMethod === 'Secante'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Método Secante
          </button>
        </div>
      </div>

      {/* Playback Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            title="Reiniciar a iteración 0"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrev}
            disabled={currentStepIndex <= 0}
            title="Paso anterior"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pausar' : 'Reproducir'}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" /> Pausar
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Reproducir
              </>
            )}
          </button>
          <button
            onClick={handleNext}
            disabled={currentStepIndex >= totalSteps - 1}
            title="Siguiente paso"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Step Scrubber Slider */}
        <div className="flex items-center gap-3 flex-1 min-w-[200px] max-w-sm">
          <span className="text-xs font-mono text-slate-400 shrink-0">
            Paso {currentStepIndex} / {Math.max(0, totalSteps - 1)}
          </span>
          <input
            type="range"
            min="0"
            max={Math.max(0, totalSteps - 1)}
            value={currentStepIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onStepChange(Number(e.target.value));
            }}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>Velocidad:</span>
          <select
            value={playSpeed}
            onChange={(e) => setPlaySpeed(Number(e.target.value))}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs cursor-pointer"
          >
            <option value={1400}>0.5x (Lento)</option>
            <option value={800}>1.0x (Normal)</option>
            <option value={400}>2.0x (Rápido)</option>
          </select>
        </div>
      </div>

      {/* Step Detail Display */}
      {currentIter ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Tasa actual (λ):</span>
              <span className="text-base font-bold font-mono text-cyan-300">
                {currentIter.x.toFixed(3)} <span className="text-[10px] text-slate-400">req/s</span>
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Latencia W(λ):</span>
              <span className="text-base font-bold font-mono text-slate-200">
                {((1 / Math.max(1e-4, mu - currentIter.x)) * 1000).toFixed(1)}{' '}
                <span className="text-[10px] text-slate-400">ms</span>
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Residuo f(λ) = W − T:</span>
              <span
                className={`text-base font-bold font-mono ${
                  Math.abs(currentIter.fx) < 1e-4
                    ? 'text-emerald-400'
                    : currentIter.fx < 0
                    ? 'text-cyan-400'
                    : 'text-rose-400'
                }`}
              >
                {currentIter.fx.toFixed(5)}
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Error absoluto:</span>
              <span className="text-base font-bold font-mono text-amber-300">
                {currentIter.errorAbs.toExponential(3)}
              </span>
            </div>
          </div>

          {/* Natural language narrative for this exact step */}
          <div className="p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-xs text-slate-200 leading-relaxed">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-1">
              <span>Interpretación del Paso {currentStepIndex}:</span>
            </div>
            <p className="text-slate-300">{currentIter.stepExplanation}</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500 text-xs">
          No hay iteraciones disponibles para mostrar.
        </div>
      )}
    </div>
  );
};
