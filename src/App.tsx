import React, { useState, useMemo } from 'react';
import { Controls, SimulatorParams, PRESETS } from './components/Controls';
import { LatencyChart } from './components/LatencyChart';
import { ConvergenceChart } from './components/ConvergenceChart';
import { IterationTable } from './components/IterationTable';
import { TheorySection } from './components/TheorySection';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import { StepByStepPlayer } from './components/StepByStepPlayer';
import { ChallengeSection } from './components/ChallengeSection';
import { ABComparison } from './components/ABComparison';
import { GlossaryModal } from './components/GlossaryModal';
import { newtonRaphson, secantMethod } from './lib/solvers';
import { getAnalyticalRoot, getAttackThreshold } from './lib/mm1';
import {
  ShieldAlert,
  Activity,
  Gauge,
  BookOpen,
  Target,
  Sparkles,
  Server,
  Layers,
  Zap,
} from 'lucide-react';

export default function App() {
  // Main parameters
  const [params, setParams] = useState<SimulatorParams>({
    mu: 1000,
    T: 0.5,
    lambdaLegitimo: 300,
    x0Newton: 800,
    x0Secant: 800,
    x1Secant: 900,
    tolerance: 1e-6,
    useNoise: false,
    noiseSigma: 0.04,
    noiseSeed: 42,
  });

  // Active view tab
  const [activeTab, setActiveTab] = useState<'simulador' | 'rendimiento' | 'teoria' | 'avanzado'>('simulador');

  // Step-by-step player state
  const [activeMethod, setActiveMethod] = useState<'Newton-Raphson' | 'Secante'>('Newton-Raphson');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Glossary modal state
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);

  // Compute analytical benchmark root
  const analyticalRoot = useMemo(() => {
    return getAnalyticalRoot(params.mu, params.T);
  }, [params.mu, params.T]);

  // Compute attack threshold
  const attackInfo = useMemo(() => {
    return getAttackThreshold(analyticalRoot, params.lambdaLegitimo);
  }, [analyticalRoot, params.lambdaLegitimo]);

  // Run solvers
  const results = useMemo(() => {
    const newton = newtonRaphson(
      params.mu,
      params.T,
      params.x0Newton,
      params.tolerance,
      50,
      analyticalRoot,
      {
        useNoise: params.useNoise,
        noiseSigma: params.noiseSigma,
        noiseSeed: params.noiseSeed,
      }
    );

    const secant = secantMethod(
      params.mu,
      params.T,
      params.x0Secant,
      params.x1Secant,
      params.tolerance,
      50,
      analyticalRoot,
      {
        useNoise: params.useNoise,
        noiseSigma: params.noiseSigma,
        noiseSeed: params.noiseSeed,
      }
    );

    return { newton, secant };
  }, [params, analyticalRoot]);

  // Highlight step lambda for the latency chart
  const activeHistory = activeMethod === 'Newton-Raphson' ? results.newton.history : results.secant.history;
  const highlightedLambda = activeHistory[currentStepIndex]?.x ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Banner / Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-slate-100 tracking-tight">
                  Simulador de Predicción de Umbrales DoS/DDoS
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  M/M/1 Solver
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Comparativa de Solvers Numéricos: <span className="text-emerald-400 font-semibold">Newton-Raphson</span> vs <span className="text-amber-400 font-semibold">Método de la Secante</span>
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('simulador')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'simulador'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              Simulador & Gráficas
            </button>
            <button
              onClick={() => setActiveTab('rendimiento')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'rendimiento'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Gauge className="w-4 h-4" />
              Rendimiento & Benchmark
            </button>
            <button
              onClick={() => setActiveTab('teoria')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'teoria'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Explicación Teórica
            </button>
            <button
              onClick={() => setActiveTab('avanzado')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'avanzado'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Target className="w-4 h-4" />
              Reto & Comparador A/B
            </button>
          </nav>
        </div>

        {/* Global Key Metrics Ribbon */}
        <div className="bg-slate-900/60 border-t border-slate-800/80 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">Umbral Crítico (λ*):</span>
                <strong className="text-cyan-300 font-mono text-sm">{analyticalRoot.toFixed(1)} req/s</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">Tráfico Legítimo:</span>
                <strong className="text-slate-200 font-mono">{params.lambdaLegitimo} req/s</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">Ataque requerido (λ_ataque):</span>
                <strong className="text-rose-400 font-mono text-sm">
                  {attackInfo.attackRate.toFixed(1)} req/s
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${
                  attackInfo.serverOverloadedByLegit
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                    : attackInfo.saturationRatio > 80
                    ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
                {attackInfo.serverOverloadedByLegit
                  ? 'Servidor Saturado por Tráfico Normal'
                  : attackInfo.saturationRatio > 80
                  ? 'Alerta: Margen DoS Crítico (<20%)'
                  : 'Margen de Seguridad Operativo'}
              </span>

              {params.useNoise && (
                <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800 text-[10px] font-mono">
                  Ruido: {(params.noiseSigma * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tab 1: Simulator & Graphics */}
        {activeTab === 'simulador' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls Column */}
              <div className="lg:col-span-1 space-y-6">
                <Controls
                  params={params}
                  onChange={setParams}
                  onOpenGlossary={() => setIsGlossaryOpen(true)}
                />

                {/* Step-by-Step Interactive Player */}
                <StepByStepPlayer
                  newtonResult={results.newton}
                  secantResult={results.secant}
                  activeMethod={activeMethod}
                  onSelectMethod={setActiveMethod}
                  currentStepIndex={currentStepIndex}
                  onStepChange={setCurrentStepIndex}
                  T={params.T}
                  mu={params.mu}
                />
              </div>

              {/* Charts Column */}
              <div className="lg:col-span-2 space-y-6">
                <LatencyChart
                  mu={params.mu}
                  T={params.T}
                  lambdaLegitimo={params.lambdaLegitimo}
                  analyticalRoot={analyticalRoot}
                  historyNewton={results.newton.history}
                  historySecant={results.secant.history}
                  highlightStepLambda={highlightedLambda}
                />

                <ConvergenceChart
                  historyNewton={results.newton.history}
                  historySecant={results.secant.history}
                  tolerance={params.tolerance}
                />
              </div>
            </div>

            {/* Iteration Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <IterationTable
                result={results.newton}
                mu={params.mu}
                selectedIterationIndex={activeMethod === 'Newton-Raphson' ? currentStepIndex : undefined}
                onSelectIteration={(idx) => {
                  setActiveMethod('Newton-Raphson');
                  setCurrentStepIndex(idx);
                }}
              />
              <IterationTable
                result={results.secant}
                mu={params.mu}
                selectedIterationIndex={activeMethod === 'Secante' ? currentStepIndex : undefined}
                onSelectIteration={(idx) => {
                  setActiveMethod('Secante');
                  setCurrentStepIndex(idx);
                }}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Performance & Benchmark */}
        {activeTab === 'rendimiento' && (
          <div className="space-y-6">
            <BenchmarkPanel
              newtonResult={results.newton}
              secantResult={results.secant}
              mu={params.mu}
              T={params.T}
              lambdaLegitimo={params.lambdaLegitimo}
              analyticalRoot={analyticalRoot}
              x0Newton={params.x0Newton}
              x0Secant={params.x0Secant}
              x1Secant={params.x1Secant}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConvergenceChart
                historyNewton={results.newton.history}
                historySecant={results.secant.history}
                tolerance={params.tolerance}
              />
              <LatencyChart
                mu={params.mu}
                T={params.T}
                lambdaLegitimo={params.lambdaLegitimo}
                analyticalRoot={analyticalRoot}
                historyNewton={results.newton.history}
                historySecant={results.secant.history}
                highlightStepLambda={highlightedLambda}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Theoretical Foundations */}
        {activeTab === 'teoria' && (
          <div className="space-y-6">
            <TheorySection />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LatencyChart
                mu={params.mu}
                T={params.T}
                lambdaLegitimo={params.lambdaLegitimo}
                analyticalRoot={analyticalRoot}
                historyNewton={results.newton.history}
                historySecant={results.secant.history}
              />
              <ConvergenceChart
                historyNewton={results.newton.history}
                historySecant={results.secant.history}
                tolerance={params.tolerance}
              />
            </div>
          </div>
        )}

        {/* Tab 4: Challenge & A/B Infrastructure */}
        {activeTab === 'avanzado' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChallengeSection
                mu={params.mu}
                T={params.T}
                analyticalRoot={analyticalRoot}
                lambdaLegitimo={params.lambdaLegitimo}
              />
              <ABComparison
                currentParams={{
                  mu: params.mu,
                  T: params.T,
                  lambdaLegitimo: params.lambdaLegitimo,
                }}
                onApplyConfig={(c) => {
                  setParams({
                    ...params,
                    mu: c.mu,
                    T: c.T,
                    lambdaLegitimo: c.lambdaLegitimo,
                  });
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Glossary Modal */}
      <GlossaryModal isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />
    </div>
  );
}
