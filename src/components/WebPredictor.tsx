import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Globe,
  Play,
  Square,
  Activity,
  Cpu,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Info,
  ShieldCheck,
  BookOpen,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  computeProbeStats,
  estimateCapacity,
  getModelLatency,
  solveQueueThreshold,
  buildConvergenceSeries,
  QueueModelType,
} from '../lib/queueModels';
import { validateTargetUrl } from '../lib/urlValidation';

export interface ProbeSample {
  index: number;
  total: number;
  ok: boolean;
  status: number | null;
  latencySec: number;
  latencyMs: number;
  methodUsed: 'HEAD' | 'GET';
  error?: string;
}

interface WebPredictorProps {
  onApplyToSimulator: (mu: number, T: number) => void;
}

const EXAMPLE_URLS = [
  { label: 'example.com', url: 'https://example.com' },
  { label: 'cloudflare.com', url: 'https://www.cloudflare.com' },
  { label: 'wikipedia.org', url: 'https://es.wikipedia.org' },
  { label: 'httpbin (200ms)', url: 'https://httpbin.org/delay/0.2' },
];

export const WebPredictor: React.FC<WebPredictorProps> = ({ onApplyToSimulator }) => {
  // Step 1: Probe configuration
  const [urlInput, setUrlInput] = useState<string>('https://example.com');
  const [probeCount, setProbeCount] = useState<number>(12);
  const [probeRate, setProbeRate] = useState<number>(2.5);
  const [probeMethod, setProbeMethod] = useState<'HEAD' | 'GET'>('HEAD');

  // Probe execution state
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probedUrl, setProbedUrl] = useState<string | null>(null);
  const [samples, setSamples] = useState<ProbeSample[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Step 2: Capacity configuration (backend workers/cores c)
  const [workers, setWorkers] = useState<number>(4);

  // Step 3 & 4: Queueing model & SLA threshold T (in seconds)
  const [selectedModel, setSelectedModel] = useState<QueueModelType>('MG1');
  const [slaMode, setSlaMode] = useState<'double' | '200ms' | '500ms' | '1000ms' | 'custom'>('double');
  const [customSlaMs, setCustomSlaMs] = useState<number>(250);
  const [showSolverHistory, setShowSolverHistory] = useState<boolean>(true);
  const [chartView, setChartView] = useState<'latency' | 'convergence'>('latency');
  const [showBeginnerGuide, setShowBeginnerGuide] = useState<boolean>(true);
  const [selectedNewtonK, setSelectedNewtonK] = useState<number | null>(null);
  const [selectedSecantK, setSelectedSecantK] = useState<number | null>(null);

  // Derived Step 1 stats
  const validLatenciesSec = useMemo(
    () => samples.filter((s) => s.ok && s.latencySec > 0).map((s) => s.latencySec),
    [samples]
  );

  const stats = useMemo(() => computeProbeStats(validLatenciesSec), [validLatenciesSec]);

  // Derived Step 2 capacity
  const capacity = useMemo(
    () => estimateCapacity(stats.medianS0, workers),
    [stats.medianS0, workers]
  );

  // Derived Step 4 SLA threshold T in seconds
  const effectiveTSec = useMemo(() => {
    if (slaMode === 'double') {
      return stats.medianS0 > 0 ? Math.max(0.05, Number((stats.medianS0 * 2).toFixed(4))) : 0.2;
    }
    if (slaMode === '200ms') return 0.2;
    if (slaMode === '500ms') return 0.5;
    if (slaMode === '1000ms') return 1.0;
    return Math.max(0.01, customSlaMs / 1000);
  }, [slaMode, stats.medianS0, customSlaMs]);

  // Derived Step 4 numerical & analytical solution
  const solution = useMemo(() => {
    if (capacity.muTotal <= 0) return null;
    return solveQueueThreshold(
      effectiveTSec,
      {
        model: selectedModel,
        muTotal: capacity.muTotal,
        workers: capacity.workers,
        cv: stats.cv,
      },
      { tolerance: 1e-6, maxIterations: 60, includeCrossModel: true }
    );
  }, [capacity, effectiveTSec, selectedModel, stats.cv]);

  // Step 3 curve comparison data (M/M/1, M/G/1, M/M/c)
  const curveData = useMemo(() => {
    if (capacity.muTotal <= 0) return [];
    const points = 65;
    const maxLambda = capacity.muTotal * 0.985;
    const paramsBase = { muTotal: capacity.muTotal, workers: capacity.workers, cv: stats.cv };

    return Array.from({ length: points }, (_, i) => {
      const lambda = (i / (points - 1)) * maxLambda;
      const wMM1 = getModelLatency(lambda, { ...paramsBase, model: 'MM1' }) * 1000;
      const wMG1 = getModelLatency(lambda, { ...paramsBase, model: 'MG1' }) * 1000;
      const wMMC = getModelLatency(lambda, { ...paramsBase, model: 'MMC' }) * 1000;
      return {
        lambda: Number(lambda.toFixed(2)),
        mm1Ms: Number(Math.min(wMM1, effectiveTSec * 3500).toFixed(2)),
        mg1Ms: Number(Math.min(wMG1, effectiveTSec * 3500).toFixed(2)),
        mmcMs: Number(Math.min(wMMC, effectiveTSec * 3500).toFixed(2)),
      };
    });
  }, [capacity, stats.cv, effectiveTSec]);

  const convergenceData = useMemo(() => {
    if (!solution || !solution.feasible) return [];
    return buildConvergenceSeries(solution.newton, solution.secant);
  }, [solution]);

  const startProbe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const check = validateTargetUrl(urlInput);
    if (!check.valid) {
      setProbeError(check.error || 'URL inválida.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProbing(true);
    setProbeError(null);
    setSamples([]);
    setProbedUrl(check.normalizedUrl || urlInput);

    try {
      const response = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: check.normalizedUrl,
          count: probeCount,
          ratePerSec: probeRate,
          method: probeMethod,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let msg = `Error HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error) msg = errJson.error;
        } catch {
          // ignore
        }
        setProbeError(msg);
        setIsProbing(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setProbeError('No se pudo leer el flujo de respuesta del servidor.');
        setIsProbing(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'meta' && event.url) {
              setProbedUrl(event.url);
            } else if (event.type === 'sample') {
              setSamples((prev) => [...prev, event as ProbeSample]);
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User stopped probe
      } else {
        setProbeError(err instanceof Error ? err.message : 'Error al sondear el destino.');
      }
    } finally {
      setIsProbing(false);
      abortControllerRef.current = null;
    }
  };

  const stopProbe = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProbing(false);
  };

  const activeRoot =
    solution && solution.feasible
      ? solution.newton.converged
        ? solution.newton.root
        : solution.secant.root
      : null;

  return (
    <div className="space-y-6">
      {/* Intro & Academic Notice + Beginner Guide */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Predictor Web por Sondeo de Línea Base & Teoría de Colas
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Descubre cuántas peticiones por segundo soporta una página web antes de volverse lenta. Medimos su rapidez en reposo{' '}
                <span className="font-mono text-emerald-300">(S₀)</span> y su estabilidad{' '}
                <span className="font-mono text-amber-300">(CV)</span> para calcular el punto de saturación{' '}
                <span className="font-mono text-cyan-300">(λ*)</span> usando{' '}
                <strong className="text-emerald-300">Newton-Raphson</strong> y el{' '}
                <strong className="text-amber-300">Método de la Secante</strong>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3 py-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Sondeo benigno: máx. {probeCount} req a {probeRate} req/s</span>
            </div>
            <button
              type="button"
              onClick={() => setShowBeginnerGuide((v) => !v)}
              aria-expanded={showBeginnerGuide}
              className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>{showBeginnerGuide ? 'Ocultar guía' : '¿Cómo funciona?'}</span>
              {showBeginnerGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showBeginnerGuide && (
          <div className="pt-3 border-t border-slate-700/70 space-y-2.5">
            <p className="text-xs text-slate-300">
              <strong className="text-cyan-300">¿Sin experiencia previa? Piénsalo como las cajas de un supermercado:</strong>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1">
                <div className="font-bold text-indigo-300">1. Medir en tienda vacía (S₀, CV)</div>
                <p className="text-slate-400 leading-relaxed">
                  Mandamos unas pocas visitas suaves para medir cuánto tarda un cliente solo en pagar (S₀) y si todos tardan parecido o unos mucho más que otros (CV).
                </p>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1">
                <div className="font-bold text-cyan-300">2. Contar capacidad (μ)</div>
                <p className="text-slate-400 leading-relaxed">
                  Si una caja tarda S₀ segundos, atiende <span className="font-mono text-slate-200">1/S₀</span> clientes/s. Con <span className="font-mono text-slate-200">c</span> cajas abiertas en paralelo, la capacidad total es <span className="font-mono text-slate-200">c/S₀</span>.
                </p>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1">
                <div className="font-bold text-amber-300">3. Simular la fila W(λ)</div>
                <p className="text-slate-400 leading-relaxed">
                  Cuando llegan más clientes por segundo (λ), empieza a formarse cola. Al acercarse a μ, el tiempo de espera se dispara exponencialmente.
                </p>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1">
                <div className="font-bold text-emerald-300">4. Hallar λ* (Newton y Secante)</div>
                <p className="text-slate-400 leading-relaxed">
                  Buscamos el tráfico límite λ* donde la espera iguala tu tope tolerable <span className="font-mono text-slate-200">T</span> (<span className="font-mono text-slate-200">W(λ) − T = 0</span>) usando tangentes (Newton) y rectas secantes.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 1: Baseline Probing */}
      <section className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              Paso 1 de 4
            </span>
            <h3 className="text-base font-bold text-slate-100 mt-1">
              Sondeo de Línea Base (S₀) y Variabilidad (CV)
            </h3>
          </div>
          {isProbing && (
            <span className="text-xs font-mono text-cyan-300 animate-pulse">
              Sondeando {samples.length} / {probeCount} peticiones...
            </span>
          )}
        </div>

        {/* Form & Config */}
        <form onSubmit={startProbe} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-6 space-y-1.5">
              <label htmlFor="probe-url-input" className="block text-xs font-semibold text-slate-300">
                Enlace de la página web (HTTP / HTTPS):
              </label>
              <input
                id="probe-url-input"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com"
                disabled={isProbing}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="lg:col-span-2 space-y-1.5">
              <label htmlFor="probe-count-select" className="block text-xs font-semibold text-slate-300">
                Peticiones (N):
              </label>
              <select
                id="probe-count-select"
                value={probeCount}
                onChange={(e) => setProbeCount(Number(e.target.value))}
                disabled={isProbing}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
              >
                <option value={10}>10 peticiones</option>
                <option value={12}>12 peticiones</option>
                <option value={15}>15 peticiones</option>
                <option value={20}>20 peticiones</option>
              </select>
            </div>

            <div className="lg:col-span-2 space-y-1.5">
              <label htmlFor="probe-rate-select" className="block text-xs font-semibold text-slate-300">
                Ritmo (req/s):
              </label>
              <select
                id="probe-rate-select"
                value={probeRate}
                onChange={(e) => setProbeRate(Number(e.target.value))}
                disabled={isProbing}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
              >
                <option value={2}>2.0 req/s</option>
                <option value={2.5}>2.5 req/s</option>
                <option value={3}>3.0 req/s</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              {!isProbing ? (
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Iniciar Sondeo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopProbe}
                  className="w-full px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  Detener
                </button>
              )}
            </div>
          </div>

          {/* Quick URL Examples & HTTP Method */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400">Ejemplos rápidos:</span>
              {EXAMPLE_URLS.map((ex) => (
                <button
                  key={ex.url}
                  type="button"
                  disabled={isProbing}
                  onClick={() => setUrlInput(ex.url)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <span>Método:</span>
              <select
                aria-label="Método HTTP de sondeo"
                value={probeMethod}
                onChange={(e) => setProbeMethod(e.target.value as 'HEAD' | 'GET')}
                disabled={isProbing}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
              >
                <option value="HEAD">HEAD (auto-fallback GET)</option>
                <option value="GET">GET</option>
              </select>
            </div>
          </div>
        </form>

        {probeError && (
          <div className="p-3.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{probeError}</span>
          </div>
        )}

        {/* Probe Progress + Sample Chart + Stats */}
        {samples.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-slate-700/70">
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>Destino: {probedUrl}</span>
                <span>
                  {samples.length} / {probeCount} muestras ({stats.validSamples} válidas)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (samples.length / probeCount) * 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sample Bar Chart */}
              <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between">
                  <span>Latencia por Petición (ms)</span>
                  <span className="font-mono text-emerald-400">
                    Mediana S₀ = {(stats.medianS0 * 1000).toFixed(1)} ms
                  </span>
                </h4>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={samples} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="index" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit=" ms" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const s = payload[0].payload as ProbeSample;
                          return (
                            <div className="bg-slate-950 border border-slate-700 p-2 rounded text-xs font-mono space-y-0.5">
                              <p className="text-slate-200 font-bold">Muestra #{s.index}</p>
                              <p className="text-cyan-300">Latencia: {s.latencyMs} ms ({s.latencySec.toFixed(4)} s)</p>
                              <p className={s.ok ? 'text-emerald-400' : 'text-rose-400'}>
                                {s.ok ? `HTTP ${s.status} (${s.methodUsed})` : s.error || `HTTP ${s.status}`}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="latencyMs" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Latencia (ms)" />
                      {stats.medianS0 > 0 && (
                        <ReferenceLine
                          y={stats.medianS0 * 1000}
                          stroke="#34d399"
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          label={{ value: 'S₀', fill: '#34d399', fontSize: 11, position: 'insideTopLeft' }}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Computed Step 1 Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 text-xs">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-emerald-500/30">
                  <span className="text-slate-400 block text-[11px]">Latencia Mediana (S₀):</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {stats.medianS0.toFixed(4)} s
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 ml-2">
                    ({(stats.medianS0 * 1000).toFixed(1)} ms)
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Media (S̄) y Desv. Estándar (σ):</span>
                  <span className="font-mono font-bold text-slate-200">
                    {(stats.meanS * 1000).toFixed(1)} ms ± {(stats.stdDevS * 1000).toFixed(1)} ms
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-amber-500/30 col-span-2 lg:col-span-1">
                  <span className="text-slate-400 block text-[11px]">Coeficiente de Variación (CV = σ / S̄):</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-lg font-bold font-mono text-amber-300">
                      {stats.cv.toFixed(3)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300">
                      {stats.cv < 0.35
                        ? 'Baja dispersión'
                        : stats.cv < 0.85
                        ? 'Dispersión moderada'
                        : 'Alta variabilidad (M/G/1 clave)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {stats.validSamples > 0 && stats.medianS0 > 0 && (
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-slate-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <p>
                    <strong className="text-slate-100">¿Qué significan estos números?</strong>{' '}
                    Tomamos la <strong className="text-emerald-300">mediana ({(stats.medianS0 * 1000).toFixed(1)} ms)</strong> en lugar del promedio para que un microcorte o pico puntual de internet no infle la latencia base.
                  </p>
                  <p className="text-slate-400">
                    {stats.cv < 0.35
                      ? `Tu sitio respondió de forma muy estable (CV = ${stats.cv.toFixed(3)}): casi todas las peticiones tardaron parecido.`
                      : stats.cv < 0.85
                      ? `Tu sitio mostró variación moderada (CV = ${stats.cv.toFixed(3)}), algo habitual por caché parcial o fluctuaciones de red.`
                      : `Tu sitio tuvo respuestas muy desiguales o en ráfagas (CV = ${stats.cv.toFixed(3)}): esa irregularidad hace que las colas crezcan mucho más rápido en el modelo M/G/1.`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* STEPS 2, 3 & 4: Show once we have valid baseline stats */}
      {stats.validSamples > 0 && stats.medianS0 > 0 && (
        <>
          {/* STEP 2: Capacity Estimation */}
          <section className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Paso 2 de 4
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Estimación de Capacidad del Servidor (μ)
                </h3>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <label htmlFor="workers-input" className="text-slate-300 font-semibold">
                  Workers / Cores (c):
                </label>
                <input
                  id="workers-input"
                  type="number"
                  min={1}
                  max={64}
                  value={workers}
                  onChange={(e) => setWorkers(Math.max(1, Math.min(64, Number(e.target.value) || 1)))}
                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center font-mono text-cyan-300 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-2">
                <span className="text-slate-400 font-semibold">Capacidad por Worker (μ_worker):</span>
                <div className="bg-slate-950 p-2.5 rounded font-mono text-cyan-300 border border-slate-800">
                  μ_worker = 1 / S₀ = 1 / {stats.medianS0.toFixed(4)} ={' '}
                  <strong className="text-base text-white">{capacity.muWorker.toFixed(2)} req/s</strong>
                </div>
                <p className="text-[11px] text-slate-400">
                  Cada proceso/hilo puede atender en promedio {capacity.muWorker.toFixed(2)} peticiones por segundo con la latencia mediana medida.
                </p>
              </div>

              <div className="bg-slate-900/70 border border-cyan-500/30 rounded-xl p-4 space-y-2">
                <span className="text-cyan-300 font-semibold">Capacidad Global del Backend (μ_total):</span>
                <div className="bg-slate-950 p-2.5 rounded font-mono text-emerald-300 border border-slate-800">
                  μ_total = c × μ_worker = {capacity.workers} / {stats.medianS0.toFixed(4)} ={' '}
                  <strong className="text-base text-white">{capacity.muTotal.toFixed(2)} req/s</strong>
                </div>
                <p className="text-[11px] text-slate-400">
                  Capacidad máxima teórica asumiendo escalado paralelo entre {capacity.workers} worker{capacity.workers > 1 ? 's' : ''}.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-100">¿Qué es &ldquo;Workers / Cores (c)&rdquo;?</strong> Es cuántos carriles o procesos simultáneos atienden visitantes a la vez (por ejemplo, <code className="text-cyan-300">1</code> en un servidor pequeño o <code className="text-cyan-300">4–8</code> en un servidor multinúcleo).{' '}
                <strong className="text-emerald-300">μ_total = {capacity.muTotal.toFixed(2)} req/s</strong> es el techo absoluto: si llegan más peticiones por segundo que ese límite, el servidor colapsa porque la fila crece sin fin.
              </span>
            </div>
          </section>

          {/* STEP 3 & 4: Queue Models + Critical Threshold Resolution */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Model Selection + SLA + Solver Comparison */}
            <div className="lg:col-span-5 bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-4">
              <div className="border-b border-slate-700 pb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Pasos 3 y 4
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-400" />
                  Modelo de Cola y Umbral Crítico (λ*)
                </h3>
              </div>

              {/* Model Selector */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Modelo de Teoría de Colas W(λ):
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedModel('MM1')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer space-y-1 ${
                      selectedModel === 'MM1'
                        ? 'bg-cyan-950/60 border-cyan-400 text-slate-100'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex justify-between font-bold">
                      <span>M/M/1 Agregado (CV = 1)</span>
                      <span className="font-mono text-cyan-300">W(λ) = 1 / (μ − λ)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-normal">
                      Modelo base clásico: asume variación aleatoria estándar (CV=1) y una sola cola global.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModel('MG1')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer space-y-1 ${
                      selectedModel === 'MG1'
                        ? 'bg-amber-950/60 border-amber-400 text-slate-100'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex justify-between font-bold">
                      <span>M/G/1 Pollaczek-Khinchine (CV = {stats.cv.toFixed(2)})</span>
                      <span className="font-mono text-amber-300 text-[11px]">Incluye CV²</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-normal">
                      Usa la irregularidad real medida en tu web (CV): más realista si hay ráfagas o latencias estables.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModel('MMC')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer space-y-1 ${
                      selectedModel === 'MMC'
                        ? 'bg-emerald-950/60 border-emerald-400 text-slate-100'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex justify-between font-bold">
                      <span>M/M/{capacity.workers} Erlang C (Multi-servidor)</span>
                      <span className="font-mono text-emerald-300 text-[11px]">Solo Newton / Secante</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-normal">
                      Modela {capacity.workers} carriles paralelos reales. Sin despeje simple: exige Newton-Raphson y Secante.
                    </p>
                  </button>
                </div>
              </div>

              {/* SLA T selector */}
              <div className="space-y-2 pt-2 border-t border-slate-700/70">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Umbral de Latencia Tolerable (T / SLA):</span>
                  <span className="font-mono text-rose-300 font-bold">
                    {(effectiveTSec * 1000).toFixed(0)} ms ({effectiveTSec.toFixed(3)} s)
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {[
                    { id: 'double', label: `2 × S₀ (${(stats.medianS0 * 2000).toFixed(0)} ms)` },
                    { id: '200ms', label: '200 ms' },
                    { id: '500ms', label: '500 ms' },
                    { id: '1000ms', label: '1000 ms' },
                    { id: 'custom', label: 'Personalizado' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSlaMode(opt.id as typeof slaMode)}
                      className={`px-2.5 py-1 rounded border font-mono transition-colors cursor-pointer ${
                        slaMode === opt.id
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {slaMode === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      step={10}
                      value={customSlaMs}
                      onChange={(e) => setCustomSlaMs(Math.max(10, Number(e.target.value) || 10))}
                      className="w-28 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-rose-300"
                    />
                    <span className="text-xs text-slate-400">milisegundos</span>
                  </div>
                )}
              </div>

              {/* Resolution Result Box */}
              {solution && (
                <div className="pt-2 border-t border-slate-700/70 space-y-3">
                  {!solution.feasible ? (
                    <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                      <span>{solution.reason}</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Umbral Crítico Resuelto (λ*):</span>
                          <span className="text-xl font-extrabold font-mono text-cyan-300">
                            {activeRoot?.toFixed(2)} req/s
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {selectedModel === 'MM1' && (
                            <>Ecuación <span className="font-mono text-slate-200">f(λ) = W(λ) − T = 0</span> · Despeje analítico: λ* = μ − 1/T = {capacity.muTotal.toFixed(2)} − {(1 / effectiveTSec).toFixed(2)}</>
                          )}
                          {selectedModel === 'MG1' && (
                            <>Ecuación <span className="font-mono text-slate-200">f(λ) = W(λ) − T = 0</span> · Pollaczek-Khinchine + validación Newton/Secante (CV = {stats.cv.toFixed(3)})</>
                          )}
                          {selectedModel === 'MMC' && (
                            <>Ecuación <span className="font-mono text-slate-200">f(λ) = W(λ) − T = 0</span> · Erlang C (c = {capacity.workers}) sin fórmula cerrada → resuelto únicamente con Newton-Raphson y Secante</>
                          )}
                        </p>
                      </div>

                      {/* Solver comparison cards with beginner intuition */}
                      <div className="space-y-2">
                        <div className="text-[11px] text-slate-300 bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 leading-relaxed">
                          <strong className="text-slate-100">¿Por qué usamos Newton-Raphson y Secante?</strong>{' '}
                          Buscan en qué tráfico <span className="font-mono text-cyan-300">λ*</span> el residuo{' '}
                          <span className="font-mono text-cyan-300">f(λ) = W(λ) − T</span> se hace cero (donde la curva choca con tu límite SLA).
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div className="bg-slate-900/80 p-3 rounded-lg border border-emerald-500/30 space-y-1.5">
                            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                              <Zap className="w-3.5 h-3.5" /> Newton-Raphson
                            </span>
                            <div className="font-mono space-y-0.5 text-[11px]">
                              <div>λ* = <strong className="text-white">{solution.newton.root.toFixed(3)} req/s</strong></div>
                              <div className="text-slate-400">
                                {solution.newton.iterationsCount} pasos · {solution.newton.totalEvaluations} evals
                                {solution.newton.estimatedConvergenceOrder !== null && (
                                  <> · p≈{solution.newton.estimatedConvergenceOrder.toFixed(2)}</>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">
                              Usa la pendiente <span className="font-mono text-emerald-300">f&apos;(λ)</span> ({selectedModel === 'MMC' ? 'diferencia centrada' : 'derivada exacta'}) para saltar directo a la raíz.
                            </p>
                          </div>

                          <div className="bg-slate-900/80 p-3 rounded-lg border border-amber-500/30 space-y-1.5">
                            <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                              <Layers className="w-3.5 h-3.5" /> Método de la Secante
                            </span>
                            <div className="font-mono space-y-0.5 text-[11px]">
                              <div>λ* = <strong className="text-white">{solution.secant.root.toFixed(3)} req/s</strong></div>
                              <div className="text-slate-400">
                                {solution.secant.iterationsCount} pasos · {solution.secant.totalEvaluations} evals
                                {solution.secant.estimatedConvergenceOrder !== null && (
                                  <> · p≈{solution.secant.estimatedConvergenceOrder.toFixed(2)}</>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">
                              No calcula derivadas: traza una recta entre los últimos dos puntos (<span className="font-mono text-amber-300">λₖ₋₁, λₖ</span>) para estimar el cruce.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Plain-language verdict */}
                      {activeRoot !== null && (
                        <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-[11px] text-slate-200 space-y-1 leading-relaxed">
                          <div className="font-bold text-emerald-300">Conclusión en lenguaje sencillo:</div>
                          <p>
                            Para no superar los <strong>{(effectiveTSec * 1000).toFixed(0)} ms</strong> de respuesta, este sitio aguanta aproximadamente{' '}
                            <strong className="text-cyan-300">{activeRoot.toFixed(2)} peticiones/s</strong> (un{' '}
                            <strong>{((activeRoot / capacity.muTotal) * 100).toFixed(0)}%</strong> de su capacidad límite de {capacity.muTotal.toFixed(1)} req/s). Si recibe más tráfico sostenido que{' '}
                            <strong>{activeRoot.toFixed(2)} req/s</strong>, las visitas se acumularán en fila y la página empezará a degradarse.
                          </p>
                        </div>
                      )}

                      {/* Cross-model table */}
                      {solution.comparison && (
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1 font-mono">
                          <div className="text-slate-400 font-sans font-semibold mb-1">
                            Comparativa rápida entre los 3 modelos (para T = {(effectiveTSec * 1000).toFixed(0)} ms):
                          </div>
                          <div className="flex justify-between">
                            <span className="text-cyan-300">M/M/1 agregado:</span>
                            <span>{solution.comparison.mm1Root !== null ? `${solution.comparison.mm1Root.toFixed(2)} req/s` : 'Infactible'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-300">M/G/1 (CV={stats.cv.toFixed(2)}):</span>
                            <span>{solution.comparison.mg1Root !== null ? `${solution.comparison.mg1Root.toFixed(2)} req/s` : 'Infactible'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-300">M/M/{capacity.workers} Erlang C:</span>
                            <span>{solution.comparison.mmcRoot !== null ? `${solution.comparison.mmcRoot.toFixed(2)} req/s` : 'Infactible'}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowSolverHistory(!showSolverHistory)}
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
                        >
                          {showSolverHistory ? 'Ocultar iteraciones' : 'Ver iteraciones Newton/Secante'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onApplyToSimulator(Number(capacity.muTotal.toFixed(2)), Number(effectiveTSec.toFixed(4)))}
                          className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow"
                        >
                          <span>Enviar al Simulador</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right: Multi-model Latency Curve OR Newton vs Secant Convergence Chart */}
            <div className="lg:col-span-7 bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg flex flex-col justify-start space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    {chartView === 'latency' ? (
                      <>
                        <Activity className="w-5 h-5 text-cyan-400" />
                        Curvas de Latencia W(λ): M/M/1 vs M/G/1 vs M/M/{capacity.workers}
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-5 h-5 text-emerald-400" />
                        Convergencia Numérica: Newton-Raphson vs Secante ({selectedModel})
                      </>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {chartView === 'latency'
                      ? `Cómo sube el tiempo de respuesta al acercarse a μ_total = ${capacity.muTotal.toFixed(2)} req/s`
                      : `Descenso del error log₁₀|f(λ)| en cada iteración k hasta alcanzar |f(λ)| < 10⁻⁶`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => setChartView('latency')}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                      chartView === 'latency'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Curvas W(λ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('convergence')}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                      chartView === 'convergence'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Convergencia Newton vs Secante
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-[360px] w-full">
                {chartView === 'latency' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={curveData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="lambda"
                        stroke="#94a3b8"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: 'Tasa de llegada λ (req/s)',
                          position: 'insideBottom',
                          offset: -10,
                          fill: '#94a3b8',
                          fontSize: 12,
                        }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        tick={{ fontSize: 11 }}
                        domain={[0, Math.round(effectiveTSec * 3000)]}
                        label={{
                          value: 'Latencia W(λ) [ms]',
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
                          return (
                            <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs font-mono space-y-1">
                              <p className="text-slate-100 font-bold">λ = {d.lambda} req/s</p>
                              <p className="text-cyan-300">M/M/1: {d.mm1Ms} ms</p>
                              <p className="text-amber-300">M/G/1 (CV={stats.cv.toFixed(2)}): {d.mg1Ms} ms</p>
                              <p className="text-emerald-300">M/M/{capacity.workers} Erlang C: {d.mmcMs} ms</p>
                              <p className="text-rose-400 pt-1 border-t border-slate-800">
                                SLA T = {(effectiveTSec * 1000).toFixed(0)} ms
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />

                      <Line type="monotone" dataKey="mm1Ms" stroke="#38bdf8" strokeWidth={2.5} dot={false} name="M/M/1 Agregado" />
                      <Line type="monotone" dataKey="mg1Ms" stroke="#fbbf24" strokeWidth={2.5} dot={false} name={`M/G/1 (CV=${stats.cv.toFixed(2)})`} />
                      <Line type="monotone" dataKey="mmcMs" stroke="#34d399" strokeWidth={2.5} dot={false} name={`M/M/${capacity.workers} Erlang C`} />

                      <ReferenceLine
                        y={effectiveTSec * 1000}
                        stroke="#f43f5e"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{
                          value: `SLA T = ${(effectiveTSec * 1000).toFixed(0)} ms`,
                          position: 'insideTopRight',
                          fill: '#f43f5e',
                          fontSize: 11,
                        }}
                      />

                      {activeRoot !== null && (
                        <ReferenceLine
                          x={Number(activeRoot.toFixed(2))}
                          stroke="#c084fc"
                          strokeDasharray="3 3"
                          strokeWidth={2}
                          label={{
                            value: `λ* = ${activeRoot.toFixed(1)}`,
                            position: 'insideTopLeft',
                            fill: '#c084fc',
                            fontSize: 11,
                          }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : convergenceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={convergenceData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="k"
                        stroke="#94a3b8"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: 'Iteración (k)',
                          position: 'insideBottom',
                          offset: -10,
                          fill: '#94a3b8',
                          fontSize: 12,
                        }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: 'log₁₀ |f(λ)|',
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
                          return (
                            <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs font-mono space-y-1">
                              <p className="text-slate-100 font-bold">Iteración k = {d.k}</p>
                              {d.newtonErrAbs !== null && (
                                <p className="text-emerald-300">
                                  Newton: λ={d.newtonLambda?.toFixed(4)} · |f|={d.newtonErrAbs.toExponential(2)}
                                </p>
                              )}
                              {d.secantErrAbs !== null && (
                                <p className="text-amber-300">
                                  Secante: λ={d.secantLambda?.toFixed(4)} · |f|={d.secantErrAbs.toExponential(2)}
                                </p>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line
                        type="monotone"
                        dataKey="newtonLogErr"
                        stroke="#34d399"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        connectNulls={false}
                        name="Newton-Raphson (log₁₀ |f(λ)|)"
                      />
                      <Line
                        type="monotone"
                        dataKey="secantLogErr"
                        stroke="#fbbf24"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        connectNulls={false}
                        name="Secante (log₁₀ |f(λ)|)"
                      />
                      <ReferenceLine
                        y={-6}
                        stroke="#38bdf8"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Meta tolerancia 10⁻⁶',
                          position: 'insideBottomLeft',
                          fill: '#38bdf8',
                          fontSize: 11,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Ajusta un umbral T mayor a la latencia en vacío para visualizar las iteraciones de Newton y Secante.
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                {chartView === 'latency' ? (
                  <span>
                    Cuando la variabilidad medida <strong className="text-amber-300">CV &lt; 1</strong>, el modelo{' '}
                    <strong>M/G/1</strong> predice menor latencia de cola que M/M/1; si{' '}
                    <strong className="text-amber-300">CV &gt; 1</strong> (ráfagas o jitter), la cola satura antes. En{' '}
                    <strong>M/M/{capacity.workers} Erlang C</strong>, cada petición tarda al menos S₀ = {(stats.medianS0 * 1000).toFixed(0)} ms cuando el servidor está vacío.
                  </span>
                ) : (
                  <span>
                    Cuanto más abajo cae la línea en menos iteraciones <span className="font-mono text-slate-100">k</span>, más rápido encuentra el método el punto de saturación <span className="font-mono text-cyan-300">λ*</span>. <strong>Newton-Raphson</strong> suele caer en menos pasos gracias a la derivada, mientras que la <strong>Secante</strong> converge casi igual de rápido sin necesidad de derivar.
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Solver Iteration History & Step-by-Step Explanations */}
          {showSolverHistory && solution && solution.feasible && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                {
                  key: 'newton' as const,
                  res: solution.newton,
                  selectedK: selectedNewtonK,
                  setSelectedK: setSelectedNewtonK,
                  accent: 'text-emerald-300',
                  borderAccent: 'border-emerald-500/40',
                  subtitle:
                    selectedModel === 'MMC'
                      ? 'Derivada aproximada por diferencia finita centrada'
                      : 'Derivada analítica exacta f\'(λ)',
                },
                {
                  key: 'secant' as const,
                  res: solution.secant,
                  selectedK: selectedSecantK,
                  setSelectedK: setSelectedSecantK,
                  accent: 'text-amber-300',
                  borderAccent: 'border-amber-500/40',
                  subtitle: 'Sin derivada: pendiente entre λₖ₋₁ y λₖ',
                },
              ].map(({ key, res, selectedK, setSelectedK, accent, borderAccent, subtitle }) => {
                const activeStep =
                  res.history.find((it) => it.k === selectedK) ??
                  res.history[res.history.length - 1];

                return (
                  <div key={key} className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 shadow-lg space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-700 pb-2">
                      <div>
                        <h4 className={`text-sm font-bold ${accent}`}>
                          Paso a paso: {res.methodName} ({selectedModel})
                        </h4>
                        <p className="text-[11px] text-slate-400">{subtitle}</p>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {res.reason}
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-700 text-slate-400 text-[11px]">
                            <th className="p-1.5">Paso k</th>
                            <th className="p-1.5">λ (req/s)</th>
                            <th className="p-1.5">f(λ) = W − T</th>
                            <th className="p-1.5">Error |f(λ)|</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {res.history.map((it) => {
                            const isSelected = activeStep?.k === it.k;
                            return (
                              <tr
                                key={it.k}
                                className={`transition-colors ${
                                  isSelected ? 'bg-slate-700/70 text-white' : 'text-slate-300 hover:bg-slate-900/60'
                                }`}
                              >
                                <td className="p-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedK(it.k)}
                                    className="font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-400 cursor-pointer text-left"
                                  >
                                    k={it.k}
                                  </button>
                                </td>
                                <td className="p-1.5 text-cyan-300">{it.x.toFixed(4)}</td>
                                <td className="p-1.5">{it.fx.toExponential(3)}</td>
                                <td className="p-1.5 text-amber-300">{it.errorAbs.toExponential(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {activeStep && (
                      <div className={`p-2.5 rounded-lg bg-slate-900/80 border ${borderAccent} text-[11px] text-slate-200 leading-relaxed`}>
                        <span className="text-slate-400 block mb-0.5">
                          Explicación del paso seleccionado (haz clic en cualquier fila k):
                        </span>
                        {activeStep.stepExplanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
};
