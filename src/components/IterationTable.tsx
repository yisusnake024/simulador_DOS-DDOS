import React, { useState } from 'react';
import { SolverResult } from '../lib/solvers';
import { Zap, Layers, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface IterationTableProps {
  result: SolverResult;
  mu: number;
  onSelectIteration?: (index: number) => void;
  selectedIterationIndex?: number;
}

export const IterationTable: React.FC<IterationTableProps> = ({
  result,
  mu,
  onSelectIteration,
  selectedIterationIndex,
}) => {
  const isNewton = result.methodName === 'Newton-Raphson';

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
        <div className="flex items-center gap-2">
          {isNewton ? (
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-4 h-4" />
            </div>
          )}
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Historial: {result.methodName}
            </h4>
            <p className="text-[11px] text-slate-400">
              {result.iterationsCount} iteraciones · {result.totalEvaluations} evaluaciones
            </p>
          </div>
        </div>

        <span
          className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
            result.converged
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border-rose-800'
          }`}
        >
          {result.reason}
        </span>
      </div>

      {/* Table container */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-[11px]">
              <th className="p-2">k</th>
              <th className="p-2">λ (req/s)</th>
              <th className="p-2">W (ms)</th>
              <th className="p-2">f(λ)</th>
              {isNewton && <th className="p-2">f'(λ)</th>}
              <th className="p-2">Error Abs</th>
              <th className="p-2">Error Real</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {result.history.map((it, idx) => {
              const isSelected = selectedIterationIndex === idx;
              const latencyMs = (1 / Math.max(1e-4, mu - it.x)) * 1000;

              return (
                <tr
                  key={it.k}
                  onClick={() => onSelectIteration && onSelectIteration(idx)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? isNewton
                        ? 'bg-emerald-950/40 text-emerald-200'
                        : 'bg-amber-950/40 text-amber-200'
                      : 'hover:bg-slate-700/40 text-slate-300'
                  }`}
                >
                  <td className="p-2 font-bold">{it.k}</td>
                  <td className="p-2 text-cyan-300 font-semibold">{it.x.toFixed(3)}</td>
                  <td className="p-2 text-slate-300">{latencyMs.toFixed(1)}</td>
                  <td
                    className={`p-2 font-semibold ${
                      it.fx < 0 ? 'text-cyan-400' : 'text-rose-400'
                    }`}
                  >
                    {it.fx.toFixed(5)}
                  </td>
                  {isNewton && (
                    <td className="p-2 text-slate-400">
                      {it.dfx ? it.dfx.toFixed(6) : '—'}
                    </td>
                  )}
                  <td className="p-2 text-amber-300">{it.errorAbs.toExponential(2)}</td>
                  <td className="p-2 text-slate-400">
                    {it.errorReal !== null ? it.errorReal.toExponential(2) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-700/60 text-[10px] text-slate-500 flex items-center justify-between">
        <span>Haz clic en cualquier fila para inspeccionarla en el laboratorio paso a paso.</span>
        <span>Raíz final: {result.root.toFixed(3)} req/s</span>
      </div>
    </div>
  );
};
