import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
  ReferenceArea,
} from 'recharts';
import { getLatency } from '../lib/mm1';
import { Iteration } from '../lib/solvers';
import { Activity } from 'lucide-react';

interface LatencyChartProps {
  mu: number;
  T: number;
  lambdaLegitimo: number;
  analyticalRoot: number;
  historyNewton: Iteration[];
  historySecant: Iteration[];
  highlightStepLambda?: number | null;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({
  mu,
  T,
  lambdaLegitimo,
  analyticalRoot,
  historyNewton,
  historySecant,
  highlightStepLambda,
}) => {
  // Generate curve data points from 0 up to 0.995 * mu
  const steps = 70;
  const maxSafeLambda = Math.min(mu - 1, mu * 0.995);
  const data = Array.from({ length: steps }, (_, i) => {
    const lambda = (i / (steps - 1)) * maxSafeLambda;
    const latency = getLatency(lambda, mu);
    return {
      lambda: Number(lambda.toFixed(1)),
      latencyMs: Number((latency * 1000).toFixed(2)),
      timeoutMs: Number((T * 1000).toFixed(2)),
    };
  });

  const timeoutMs = T * 1000;
  const highlightedLatencyMs = highlightStepLambda !== undefined && highlightStepLambda !== null
    ? (getLatency(highlightStepLambda, mu) * 1000)
    : null;

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Curva de Latencia M/M/1 & Umbral Crítico
          </h3>
          <p className="text-xs text-slate-400">
            W(λ) = 1/(μ−λ) vs Timeout (T = {(T * 1000).toFixed(0)} ms)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-cyan-300">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            λ* = {analyticalRoot.toFixed(1)} req/s
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-0.5 bg-rose-400"></span>
            Timeout = {timeoutMs.toFixed(0)} ms
          </span>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 15, right: 25, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="lambda"
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              label={{
                value: 'Tasa de Solicitudes λ (req/s)',
                position: 'insideBottom',
                offset: -10,
                fill: '#94a3b8',
                fontSize: 12,
              }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              domain={[0, Math.min(2500, Math.max(timeoutMs * 2.2, 500))]}
              label={{
                value: 'Latencia (ms)',
                angle: -90,
                position: 'insideLeft',
                fill: '#94a3b8',
                fontSize: 12,
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                const isOver = d.latencyMs > timeoutMs;
                return (
                  <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                    <p className="font-bold text-slate-200">λ = {d.lambda} req/s</p>
                    <p className="text-cyan-300 flex justify-between gap-3">
                      <span>Latencia W(λ):</span>
                      <span className="font-mono font-bold">{d.latencyMs} ms</span>
                    </p>
                    <p className="text-rose-400 flex justify-between gap-3">
                      <span>Timeout límite:</span>
                      <span className="font-mono">{timeoutMs} ms</span>
                    </p>
                    <p className={`font-semibold pt-1 border-t border-slate-800 ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isOver ? '⚠ Conexiones abortadas (Timeout)' : '✓ Servicio Operativo'}
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => {
                if (value === 'latencyMs') return <span className="text-cyan-400 text-xs">Latencia W(λ)</span>;
                return <span className="text-rose-400 text-xs">Timeout T</span>;
              }}
            />

            {/* Main Latency Curve */}
            <Line
              type="monotone"
              dataKey="latencyMs"
              stroke="#38bdf8"
              strokeWidth={3}
              dot={false}
              name="latencyMs"
            />

            {/* Timeout horizontal line */}
            <ReferenceLine
              y={timeoutMs}
              stroke="#f43f5e"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Timeout = ${timeoutMs}ms`,
                position: 'top',
                fill: '#f43f5e',
                fontSize: 11,
              }}
            />

            {/* Analytical Root vertical line */}
            <ReferenceLine
              x={analyticalRoot}
              stroke="#a855f7"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: `λ* = ${analyticalRoot.toFixed(1)}`,
                position: 'insideTopLeft',
                fill: '#c084fc',
                fontSize: 10,
              }}
            />

            {/* Legitimate Traffic vertical line */}
            <ReferenceLine
              x={lambdaLegitimo}
              stroke="#10b981"
              strokeWidth={1.5}
              label={{
                value: `λ_legítimo = ${lambdaLegitimo}`,
                position: 'insideTopRight',
                fill: '#34d399',
                fontSize: 10,
              }}
            />

            {/* Highlighted active step dot */}
            {highlightStepLambda !== undefined && highlightStepLambda !== null && highlightedLatencyMs !== null && isFinite(highlightedLatencyMs) && (
              <ReferenceDot
                x={highlightStepLambda}
                y={highlightedLatencyMs}
                r={8}
                fill="#ec4899"
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-300">
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-emerald-400 font-semibold block mb-0.5">Zona Operativa Segura:</span>
          0 ≤ λ &lt; {analyticalRoot.toFixed(1)} req/s (latencia &lt; {timeoutMs} ms)
        </div>
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-rose-400 font-semibold block mb-0.5">Zona de Ataque DoS:</span>
          λ ≥ {analyticalRoot.toFixed(1)} req/s (latencia supera timeout y caen clientes)
        </div>
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-purple-400 font-semibold block mb-0.5">Asíntota del Servidor:</span>
          λ → μ ({mu} req/s): colapso absoluto de cola (W → ∞)
        </div>
      </div>
    </div>
  );
};
