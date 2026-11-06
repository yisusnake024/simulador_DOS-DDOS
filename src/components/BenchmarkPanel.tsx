import React, { useState } from 'react';
import { SolverResult, benchmarkSolvers } from '../lib/solvers';
import { Gauge, Zap, Layers, Play, CheckCircle2, AlertCircle, TrendingDown, Cpu } from 'lucide-react';

interface BenchmarkPanelProps {
  newtonResult: SolverResult;
  secantResult: SolverResult;
  mu: number;
  T: number;
  lambdaLegitimo: number;
  analyticalRoot: number;
  x0Newton: number;
  x0Secant: number;
  x1Secant: number;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({
  newtonResult,
  secantResult,
  mu,
  T,
  lambdaLegitimo,
  analyticalRoot,
  x0Newton,
  x0Secant,
  x1Secant,
}) => {
  const [benchData, setBenchData] = useState<ReturnType<typeof benchmarkSolvers> | null>(null);
  const [isRunningBench, setIsRunningBench] = useState(false);

  const handleRunBenchmark = () => {
    setIsRunningBench(true);
    // Allow UI to update before blocking loop
    setTimeout(() => {
      const data = benchmarkSolvers(mu, T, x0Newton, x0Secant, x1Secant, 10000);
      setBenchData(data);
      setIsRunningBench(false);
    }, 40);
  };

  const newtonAttack = Math.max(0, newtonResult.root - lambdaLegitimo);
  const secantAttack = Math.max(0, secantResult.root - lambdaLegitimo);

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-400" />
            Comparación de Rendimiento & Métricas Numéricas
          </h3>
          <p className="text-xs text-slate-400">
            Evaluación computacional de Newton-Raphson vs Método de la Secante
          </p>
        </div>
        <button
          onClick={handleRunBenchmark}
          disabled={isRunningBench}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white text-xs font-semibold shadow transition-all cursor-pointer"
        >
          {isRunningBench ? (
            <>
              <Cpu className="w-4 h-4 animate-spin text-indigo-300" />
              Ejecutando 10,000 corridas...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Ejecutar Benchmark (10,000 ejecuciones)
            </>
          )}
        </button>
      </div>

      {/* Side-by-side metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Newton-Raphson Card */}
        <div className="bg-slate-900/70 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
              <h4 className="font-bold text-emerald-400 text-sm">Newton-Raphson (Caja Blanca)</h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
              {newtonResult.converged ? 'Convergente' : 'Incompleto'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Iteraciones (Pasos):</span>
              <span className="text-base font-bold font-mono text-emerald-300">
                {newtonResult.iterationsCount}
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Evaluaciones de f y f':</span>
              <span className="text-base font-bold font-mono text-emerald-300">
                {newtonResult.totalEvaluations}
              </span>
              <span className="text-[10px] text-slate-500 block">
                ({newtonResult.evaluationsF} f + {newtonResult.evaluationsDfx} f')
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Residuo final |f(λ)|:</span>
              <span className="font-mono text-slate-200">
                {newtonResult.finalErrorAbs.toExponential(3)}
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Error real |λ − λ*|:</span>
              <span className="font-mono text-slate-200">
                {newtonResult.finalErrorReal !== null ? newtonResult.finalErrorReal.toExponential(3) : 'N/A'}
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Orden est. (p):</span>
              <span className="font-mono text-emerald-400 font-bold">
                {newtonResult.estimatedConvergenceOrder !== null ? `≈ ${newtonResult.estimatedConvergenceOrder}` : 'p ≈ 2.0 (teórico)'}
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Tráfico de ataque est.:</span>
              <span className="font-mono text-rose-300 font-bold">
                {newtonAttack.toFixed(1)} req/s
              </span>
            </div>
          </div>
        </div>

        {/* Secant Card */}
        <div className="bg-slate-900/70 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
              <h4 className="font-bold text-amber-400 text-sm">Método de la Secante (Logs/Telemetría)</h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
              {secantResult.converged ? 'Convergente' : 'Incompleto'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Iteraciones (Pasos):</span>
              <span className="text-base font-bold font-mono text-amber-300">
                {secantResult.iterationsCount}
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Evaluaciones de f:</span>
              <span className="text-base font-bold font-mono text-amber-300">
                {secantResult.totalEvaluations}
              </span>
              <span className="text-[10px] text-amber-400/80 block">
                (Reutiliza f previa, 0 f')
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Residuo final |f(λ)|:</span>
              <span className="font-mono text-slate-200">
                {secantResult.finalErrorAbs.toExponential(3)}
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Error real |λ − λ*|:</span>
              <span className="font-mono text-slate-200">
                {secantResult.finalErrorReal !== null ? secantResult.finalErrorReal.toExponential(3) : 'N/A'}
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Orden est. (p):</span>
              <span className="font-mono text-amber-400 font-bold">
                {secantResult.estimatedConvergenceOrder !== null ? `≈ ${secantResult.estimatedConvergenceOrder}` : 'p ≈ 1.618 (φ)'}
              </span>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Tráfico de ataque est.:</span>
              <span className="font-mono text-rose-300 font-bold">
                {secantAttack.toFixed(1)} req/s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark results panel if triggered */}
      {benchData && (
        <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-indigo-300 font-bold">
            <Cpu className="w-4 h-4" />
            Resultado del Benchmark Local (10,000 ejecuciones en CPU cliente)
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Newton tiempo total:</span>
              <span className="text-emerald-400 font-bold text-sm">{benchData.newtonTimeTotalMs} ms</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Newton tiempo / corrida:</span>
              <span className="text-emerald-400 font-bold text-sm">{benchData.newtonAvgMicroseconds} μs</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Secante tiempo total:</span>
              <span className="text-amber-400 font-bold text-sm">{benchData.secantTimeTotalMs} ms</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Secante tiempo / corrida:</span>
              <span className="text-amber-400 font-bold text-sm">{benchData.secantAvgMicroseconds} μs</span>
            </div>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs leading-relaxed">
            <strong className="text-cyan-300 block mb-1">Veredicto de Rendimiento:</strong>
            {benchData.fasterMethod === 'Newton-Raphson' ? (
              <p>
                <strong>Newton-Raphson fue {benchData.speedRatio}x más rápido</strong> debido a su tasa de convergencia cuadrática, requiriendo solo {benchData.newtonIterations} iteraciones frente a las {benchData.secantIterations} de la Secante. La derivada analítica de M/M/1 es muy barata algebraicamente (1 operación cuadrática), lo que le permite superar a la Secante en velocidad de cálculo puro.
              </p>
            ) : (
              <p>
                <strong>El Método de la Secante fue {benchData.speedRatio}x más rápido</strong> al evitar el cálculo de derivadas y evaluar la función objetivo únicamente 1 vez por paso. Esto demuestra su gran ventaja práctica en sistemas donde evaluar el estado es costoso o proviene de telemetría de red.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Educational Conclusion Summary */}
      <div className="mt-4 p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">
            Conclusión de Seguridad DoS/DDoS para el servidor actual (μ = {mu} req/s, T = {(T * 1000).toFixed(0)} ms):
          </p>
          <p className="text-slate-400">
            El umbral crítico calculado es <strong className="text-cyan-300">{analyticalRoot.toFixed(1)} req/s</strong>. Dado que el tráfico legítimo actual es de <span className="font-mono text-slate-200">{lambdaLegitimo} req/s</span>, un atacante requiere inyectar al menos <strong className="text-rose-400 font-mono">{(analyticalRoot - lambdaLegitimo > 0 ? (analyticalRoot - lambdaLegitimo).toFixed(1) : '0')} req/s</strong> de tráfico malicioso sostenido para inducir timeouts generalizados y dejar fuera de servicio la aplicación.
          </p>
        </div>
      </div>
    </div>
  );
};
