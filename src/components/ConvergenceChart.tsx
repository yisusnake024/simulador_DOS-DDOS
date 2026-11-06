import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Iteration } from '../lib/solvers';
import { TrendingDown, Info } from 'lucide-react';

interface ConvergenceChartProps {
  historyNewton: Iteration[];
  historySecant: Iteration[];
  tolerance: number;
}

export const ConvergenceChart: React.FC<ConvergenceChartProps> = ({
  historyNewton,
  historySecant,
  tolerance,
}) => {
  const [useLogScale, setUseLogScale] = useState(true);

  // Combine into data series aligned by iteration k
  const maxK = Math.max(historyNewton.length, historySecant.length);
  const data = Array.from({ length: maxK }, (_, k) => {
    const n = historyNewton[k];
    const s = historySecant[k];

    const errN = n ? Math.max(1e-16, n.errorAbs) : null;
    const errS = s ? Math.max(1e-16, s.errorAbs) : null;

    return {
      k,
      label: `k=${k}`,
      newtonError: useLogScale && errN ? Number(Math.log10(errN).toFixed(2)) : errN,
      secantError: useLogScale && errS ? Number(Math.log10(errS).toFixed(2)) : errS,
      rawNewton: errN,
      rawSecant: errS,
      tolLine: useLogScale ? Number(Math.log10(tolerance).toFixed(2)) : tolerance,
    };
  });

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-emerald-400" />
            Convergencia del Error por Iteración
          </h3>
          <p className="text-xs text-slate-400">
            Comparativa de velocidad de reducción del residuo |f(λ)|
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Escala:</span>
          <button
            onClick={() => setUseLogScale(!useLogScale)}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono transition-colors cursor-pointer"
          >
            {useLogScale ? 'Logarítmica log₁₀(Error)' : 'Lineal |f(λ)|'}
          </button>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="k"
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              label={{ value: 'Iteración (k)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              domain={['auto', 'auto']}
              label={{
                value: useLogScale ? 'log₁₀(|f(λ)|)' : '|f(λ)|',
                angle: -90,
                position: 'insideLeft',
                fill: '#94a3b8',
                fontSize: 12,
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                    <p className="font-bold text-slate-200">Iteración k = {label}</p>
                    {d.rawNewton !== null && (
                      <p className="text-emerald-400 flex items-center justify-between gap-3">
                        <span>Newton |f(λ)|:</span>
                        <span className="font-mono">{d.rawNewton.toExponential(3)}</span>
                      </p>
                    )}
                    {d.rawSecant !== null && (
                      <p className="text-amber-400 flex items-center justify-between gap-3">
                        <span>Secante |f(λ)|:</span>
                        <span className="font-mono">{d.rawSecant.toExponential(3)}</span>
                      </p>
                    )}
                    <p className="text-slate-500 text-[10px] pt-1 border-t border-slate-800">
                      Tolerancia: {tolerance.toExponential(0)}
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => {
                if (value === 'newtonError') return <span className="text-emerald-400 text-xs">Newton-Raphson</span>;
                if (value === 'secantError') return <span className="text-amber-400 text-xs">Método Secante</span>;
                return <span className="text-rose-400 text-xs">Límite de Tolerancia</span>;
              }}
            />
            <Line
              type="monotone"
              dataKey="newtonError"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#10b981' }}
              activeDot={{ r: 6 }}
              name="newtonError"
            />
            <Line
              type="monotone"
              dataKey="secantError"
              stroke="#fbbf24"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#f59e0b' }}
              activeDot={{ r: 6 }}
              name="secantError"
            />
            <Line
              type="monotone"
              dataKey="tolLine"
              stroke="#f43f5e"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              name="tolLine"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-2 p-2.5 rounded bg-slate-900/60 border border-slate-800 text-slate-400 text-[11px]">
        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>
          En la escala logarítmica, la pendiente de la curva representa el orden de convergencia. La caída vertical más pronunciada de Newton-Raphson ilustra visualmente su tasa cuadrática frente a la tasa superlineal de la Secante.
        </span>
      </div>
    </div>
  );
};
