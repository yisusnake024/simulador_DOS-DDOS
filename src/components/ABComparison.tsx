import React, { useState } from 'react';
import { getAnalyticalRoot, getAttackThreshold } from '../lib/mm1';
import { Server, ArrowRight, ShieldCheck, BookmarkCheck } from 'lucide-react';

interface ConfigState {
  name: string;
  mu: number;
  T: number;
  lambdaLegitimo: number;
}

interface ABComparisonProps {
  currentParams: {
    mu: number;
    T: number;
    lambdaLegitimo: number;
  };
  onApplyConfig: (params: { mu: number; T: number; lambdaLegitimo: number }) => void;
}

export const ABComparison: React.FC<ABComparisonProps> = ({ currentParams, onApplyConfig }) => {
  const [configA, setConfigA] = useState<ConfigState>({
    name: 'Configuración A (Servidor Base)',
    mu: currentParams.mu,
    T: currentParams.T,
    lambdaLegitimo: currentParams.lambdaLegitimo,
  });

  const [configB, setConfigB] = useState<ConfigState>({
    name: 'Configuración B (Servidor Optimizado)',
    mu: Math.round(currentParams.mu * 1.5),
    T: currentParams.T,
    lambdaLegitimo: currentParams.lambdaLegitimo,
  });

  const rootA = getAnalyticalRoot(configA.mu, configA.T);
  const rootB = getAnalyticalRoot(configB.mu, configB.T);

  const attackA = getAttackThreshold(rootA, configA.lambdaLegitimo);
  const attackB = getAttackThreshold(rootB, configB.lambdaLegitimo);

  const resilienceDiff = attackA.attackRate > 0
    ? (((attackB.attackRate - attackA.attackRate) / attackA.attackRate) * 100).toFixed(0)
    : '+∞';

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-400" />
            Comparación A/B de Infraestructura & Resiliencia DoS
          </h3>
          <p className="text-xs text-slate-400">
            Evalúa el impacto de escalar capacidad (μ) o ajustar timeouts (T)
          </p>
        </div>

        <button
          onClick={() => {
            setConfigA({
              name: 'Configuración A (Guardada)',
              mu: currentParams.mu,
              T: currentParams.T,
              lambdaLegitimo: currentParams.lambdaLegitimo,
            });
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium cursor-pointer transition-colors shadow"
        >
          <BookmarkCheck className="w-4 h-4 text-emerald-400" />
          Guardar actual como Config A
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Config A */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              {configA.name}
            </span>
            <button
              onClick={() => onApplyConfig(configA)}
              className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
            >
              Cargar en simulador →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono">
            <div className="bg-slate-950 p-2 rounded">
              <span className="text-[10px] text-slate-500 block">μ (req/s):</span>
              <span className="font-bold text-slate-200">{configA.mu}</span>
            </div>
            <div className="bg-slate-950 p-2 rounded">
              <span className="text-[10px] text-slate-500 block">Timeout T:</span>
              <span className="font-bold text-slate-200">{(configA.T * 1000).toFixed(0)} ms</span>
            </div>
            <div className="bg-slate-950 p-2 rounded">
              <span className="text-[10px] text-slate-500 block">λ legítimo:</span>
              <span className="font-bold text-slate-200">{configA.lambdaLegitimo}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Umbral crítico λ*:</span>
              <span className="font-mono font-bold text-cyan-300">{rootA.toFixed(1)} req/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ataque necesario λ_ataque:</span>
              <span className="font-mono font-bold text-rose-400">{attackA.attackRate.toFixed(1)} req/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Saturación por tráfico normal:</span>
              <span className="font-mono text-slate-300">{attackA.saturationRatio.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Config B */}
        <div className="bg-slate-900/80 border border-indigo-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
              {configB.name}
            </span>
            <button
              onClick={() => onApplyConfig(configB)}
              className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
            >
              Cargar en simulador →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono">
            <div className="bg-slate-950 p-2 rounded">
              <span className="text-[10px] text-slate-500 block">μ (req/s):</span>
              <input
                type="number"
                value={configB.mu}
                onChange={(e) => setConfigB({ ...configB, mu: Number(e.target.value) })}
                className="w-full bg-transparent font-bold text-indigo-300 focus:outline-none"
              />
            </div>
            <div className="bg-slate-950 p-2 rounded">
              <span className="text-[10px] text-slate-500 block">Timeout T (s):</span>
              <input
                type="number"
                step="0.05"
                value={configB.T}
                onChange={(e) => setConfigB({ ...configB, T: Number(e.target.value) })}
                className="w-full bg-transparent font-bold text-indigo-300 focus:outline-none"
              />
            </div>
            <div className="bg-slate-950 p-2 rounded">
              <span className="text-[10px] text-slate-500 block">λ legítimo:</span>
              <input
                type="number"
                value={configB.lambdaLegitimo}
                onChange={(e) => setConfigB({ ...configB, lambdaLegitimo: Number(e.target.value) })}
                className="w-full bg-transparent font-bold text-indigo-300 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Umbral crítico λ*:</span>
              <span className="font-mono font-bold text-indigo-300">{rootB.toFixed(1)} req/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ataque necesario λ_ataque:</span>
              <span className="font-mono font-bold text-rose-400">{attackB.attackRate.toFixed(1)} req/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Saturación por tráfico normal:</span>
              <span className="font-mono text-slate-300">{attackB.saturationRatio.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Difference summary */}
      <div className="mt-4 p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-300">
            Ganancia de Resistencia DDoS en Config B:
          </span>
        </div>
        <span className="font-mono font-bold text-emerald-400 text-sm">
          {resilienceDiff}% más de tráfico de ataque requerido
        </span>
      </div>
    </div>
  );
};
