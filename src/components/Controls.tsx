import React, { useState } from 'react';
import { Sliders, RotateCcw, Activity, ShieldAlert, Cpu, Sparkles, HelpCircle } from 'lucide-react';

export interface SimulatorParams {
  mu: number;
  T: number;
  lambdaLegitimo: number;
  x0Newton: number;
  x0Secant: number;
  x1Secant: number;
  tolerance: number;
  useNoise: boolean;
  noiseSigma: number;
  noiseSeed: number;
}

interface ControlsProps {
  params: SimulatorParams;
  onChange: (newParams: SimulatorParams) => void;
  onOpenGlossary: () => void;
}

export const PRESETS = [
  {
    id: 'default',
    name: 'Estándar Académico (Recomendado)',
    desc: 'μ = 1000 req/s, T = 0.5 s, λ_leg = 300 req/s. Escenario de demostración equilibrado.',
    params: { mu: 1000, T: 0.5, lambdaLegitimo: 300 },
  },
  {
    id: 'light',
    name: 'Carga Ligera (Margen Amplio)',
    desc: 'μ = 1000 req/s, T = 0.5 s, λ_leg = 100 req/s. El servidor opera relajado y resiste mucho tráfico.',
    params: { mu: 1000, T: 0.5, lambdaLegitimo: 100 },
  },
  {
    id: 'near',
    name: 'Cerca del Umbral (Alta Vulnerabilidad)',
    desc: 'μ = 1000 req/s, T = 0.5 s, λ_leg = 950 req/s. Un ataque mínimo provoca denegación de servicio.',
    params: { mu: 1000, T: 0.5, lambdaLegitimo: 950 },
  },
  {
    id: 'strict',
    name: 'Timeout Exigente (T = 50ms)',
    desc: 'μ = 1000 req/s, T = 0.05 s, λ_leg = 300 req/s. Baja tolerancia a latencia en microservicios rápidos.',
    params: { mu: 1000, T: 0.05, lambdaLegitimo: 300 },
  },
];

export const Controls: React.FC<ControlsProps> = ({ params, onChange, onOpenGlossary }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('default');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const applyPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) {
      const newMu = preset.params.mu;
      onChange({
        ...params,
        ...preset.params,
        x0Newton: Math.round(newMu * 0.8),
        x0Secant: Math.round(newMu * 0.8),
        x1Secant: Math.round(newMu * 0.9),
      });
    }
  };

  const handleParamChange = <K extends keyof SimulatorParams>(key: K, value: SimulatorParams[K]) => {
    setSelectedPreset('custom');
    onChange({ ...params, [key]: value });
  };

  const resetToDefaults = () => {
    applyPreset('default');
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-slate-100">Parámetros del Sistema</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenGlossary}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
            title="Ver glosario de términos"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Glosario</span>
          </button>
          <button
            onClick={resetToDefaults}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
            title="Restablecer valores predeterminados"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>Escenarios Preconfigurados de Demostración:</span>
          {selectedPreset === 'custom' && (
            <span className="text-[10px] text-amber-400 font-mono">Modo Personalizado</span>
          )}
        </label>
        <select
          value={selectedPreset}
          onChange={(e) => applyPreset(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="custom" disabled>
            Personalizado (valores modificados)
          </option>
        </select>
        <p className="text-[11px] text-slate-400 leading-normal">
          {PRESETS.find((p) => p.id === selectedPreset)?.desc ??
            'Parámetros configurados a medida por el usuario.'}
        </p>
      </div>

      {/* Sliders Grid */}
      <div className="space-y-3 pt-1">
        {/* Mu */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Capacidad del Servidor (μ):
            </span>
            <span className="font-mono text-cyan-300 font-bold">{params.mu} req/s</span>
          </div>
          <input
            type="range"
            min="200"
            max="3000"
            step="50"
            value={params.mu}
            onChange={(e) => handleParamChange('mu', Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Timeout T */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              Timeout del Cliente (T):
            </span>
            <span className="font-mono text-rose-300 font-bold">
              {params.T} s ({(params.T * 1000).toFixed(0)} ms)
            </span>
          </div>
          <input
            type="range"
            min="0.02"
            max="1.5"
            step="0.01"
            value={params.T}
            onChange={(e) => handleParamChange('T', Number(e.target.value))}
            className="w-full accent-rose-400 cursor-pointer"
          />
        </div>

        {/* Lambda Legitimo */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Tráfico Legítimo Normal (λ):
            </span>
            <span className="font-mono text-emerald-300 font-bold">
              {params.lambdaLegitimo} req/s
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(10, params.mu - 10)}
            step="20"
            value={params.lambdaLegitimo}
            onChange={(e) => handleParamChange('lambdaLegitimo', Number(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <div className="pt-2 border-t border-slate-700/80">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-medium cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {showAdvanced ? 'Ocultar ajustes avanzados (Ruido y Puntos iniciales)' : 'Ver ajustes avanzados (Ruido y Puntos iniciales)'}
        </button>

        {showAdvanced && (
          <div className="mt-3 p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
            {/* Initial Guesses */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">x₀ Newton (req/s):</label>
                <input
                  type="number"
                  value={params.x0Newton}
                  onChange={(e) => handleParamChange('x0Newton', Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-emerald-300"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">x₀ Secante (req/s):</label>
                <input
                  type="number"
                  value={params.x0Secant}
                  onChange={(e) => handleParamChange('x0Secant', Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-amber-300"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">x₁ Secante (req/s):</label>
                <input
                  type="number"
                  value={params.x1Secant}
                  onChange={(e) => handleParamChange('x1Secant', Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-amber-300"
                />
              </div>
            </div>

            {/* Tolerance */}
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Tolerancia de parada (|f(λ)| &lt; ε):</label>
              <select
                value={params.tolerance}
                onChange={(e) => handleParamChange('tolerance', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
              >
                <option value={1e-4}>10⁻⁴ (Rápida)</option>
                <option value={1e-6}>10⁻⁶ (Estándar)</option>
                <option value={1e-8}>10⁻⁸ (Alta precisión)</option>
              </select>
            </div>

            {/* Noise Simulation */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Modo Ruido de Telemetría:</span>
                <input
                  type="checkbox"
                  checked={params.useNoise}
                  onChange={(e) => handleParamChange('useNoise', e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                />
              </div>

              {params.useNoise && (
                <div className="space-y-2 pt-1 font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Intensidad del ruido (σ):</span>
                    <span className="text-indigo-300">{(params.noiseSigma * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.15"
                    step="0.01"
                    value={params.noiseSigma}
                    onChange={(e) => handleParamChange('noiseSigma', Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-400 font-sans">Semilla Reproducible (Seed):</span>
                    <input
                      type="number"
                      value={params.noiseSeed}
                      onChange={(e) => handleParamChange('noiseSeed', Number(e.target.value))}
                      className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
