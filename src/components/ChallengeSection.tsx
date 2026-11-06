import React, { useState } from 'react';
import { Target, CheckCircle2, AlertTriangle, ArrowRight, Award } from 'lucide-react';

interface ChallengeSectionProps {
  mu: number;
  T: number;
  analyticalRoot: number;
  lambdaLegitimo: number;
}

export const ChallengeSection: React.FC<ChallengeSectionProps> = ({
  mu,
  T,
  analyticalRoot,
  lambdaLegitimo,
}) => {
  const [userGuess, setUserGuess] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userGuess.trim()) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setUserGuess('');
    setSubmitted(false);
  };

  const guessNum = Number(userGuess);
  const diff = Math.abs(guessNum - analyticalRoot);
  const percentageError = (diff / analyticalRoot) * 100;

  let feedbackBadge = {
    title: '¡Precisión Asombrosa!',
    color: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300',
    icon: Award,
    description: 'Calculaste o estimaste el umbral prácticamente exacto.',
  };

  if (percentageError > 10) {
    feedbackBadge = {
      title: 'Desviación Alta',
      color: 'bg-rose-950/80 border-rose-500/60 text-rose-300',
      icon: AlertTriangle,
      description: 'Tu estimación está lejos del umbral asintótico. Recuerda que la latencia se dispara cerca de μ.',
    };
  } else if (percentageError > 3) {
    feedbackBadge = {
      title: 'Buena Aproximación',
      color: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
      icon: CheckCircle2,
      description: 'Estás muy cerca del umbral crítico de timeout.',
    };
  }

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2.5 border-b border-slate-700 pb-3 mb-4">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">
            Reto Interactivo: Predice el Umbral DoS/DDoS
          </h3>
          <p className="text-xs text-slate-400">
            Pon a prueba tu intuición numérica antes de revelar el cálculo del solver
          </p>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-300 leading-relaxed">
          <span className="font-semibold text-amber-400 block mb-1">Misión de Diagnóstico:</span>
          Para un servidor con capacidad <strong className="text-cyan-300">μ = {mu} req/s</strong> y un timeout de cliente de <strong className="text-rose-300">T = {(T * 1000).toFixed(0)} ms ({T} s)</strong>, ¿cuál crees que es la tasa crítica total <span className="font-mono text-cyan-300">λ*</span> (req/s) que satura el sistema?
        </div>

        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="number"
              placeholder="Ej: 950"
              value={userGuess}
              onChange={(e) => {
                setUserGuess(e.target.value);
                setSubmitted(false);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-500">req/s</span>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow"
          >
            Verificar Estimación
            <ArrowRight className="w-4 h-4" />
          </button>

          {submitted && (
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors cursor-pointer"
            >
              Reiniciar
            </button>
          )}
        </form>

        {submitted && (
          <div className={`p-4 rounded-xl border ${feedbackBadge.color} space-y-2 mt-3 animate-fade-in`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              <feedbackBadge.icon className="w-4 h-4" />
              <span>{feedbackBadge.title}</span>
            </div>
            <p className="text-xs leading-relaxed">{feedbackBadge.description}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-700/50 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Tu estimación:</span>
                <span className="font-bold text-slate-100">{guessNum} req/s</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Umbral exacto λ*:</span>
                <span className="font-bold text-cyan-300">{analyticalRoot.toFixed(2)} req/s</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Diferencia absoluta:</span>
                <span className="font-bold text-rose-300">{diff.toFixed(2)} req/s ({percentageError.toFixed(1)}%)</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              Fórmula analítica directa: λ* = μ − 1/T = {mu} − 1/{T} = {analyticalRoot.toFixed(2)} req/s.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
