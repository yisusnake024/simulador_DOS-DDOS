import React, { useState } from 'react';
import { BookOpen, ShieldAlert, Zap, Layers, Activity, HelpCircle, CheckCircle, AlertTriangle } from 'lucide-react';

export const TheorySection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mm1' | 'newton' | 'secante' | 'comparativa'>('mm1');

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg backdrop-blur">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Fundamento Teórico & Predicción de Umbrales DoS/DDoS
            </h2>
            <p className="text-xs text-slate-400">
              Modelado matemático de colas M/M/1 y resolución numérica para ciberseguridad
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('mm1')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'mm1' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Modelo M/M/1 & DoS
          </button>
          <button
            onClick={() => setActiveTab('newton')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'newton' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Newton-Raphson
          </button>
          <button
            onClick={() => setActiveTab('secante')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'secante' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Método Secante
          </button>
          <button
            onClick={() => setActiveTab('comparativa')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'comparativa' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ¿Cuándo usar cuál?
          </button>
        </div>
      </div>

      {/* Tab 1: M/M/1 Model */}
      {activeTab === 'mm1' && (
        <div className="space-y-4 text-sm text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
              <h3 className="text-emerald-400 font-semibold mb-2 flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> La Cola M/M/1 y el Colapso Asintótico
              </h3>
              <p className="text-xs leading-relaxed text-slate-300 mb-2">
                En teoría de colas de Kendall, <strong>M/M/1</strong> representa un servidor con llegadas Poisson con tasa <span className="font-mono text-cyan-300">λ</span> (req/s) y tiempo de atención exponencial con tasa <span className="font-mono text-cyan-300">μ</span> (req/s).
              </p>
              <div className="bg-slate-950 p-2.5 rounded font-mono text-xs text-center border border-slate-800 text-emerald-300 my-2">
                W(λ) = 1 / (μ − λ) &nbsp;&nbsp;[segundos de latencia media]
              </div>
              <p className="text-xs text-slate-400">
                A medida que el tráfico <span className="text-cyan-300 font-mono">λ → μ</span>, el denominador tiende a cero y la latencia explota hacia el infinito. Ésta es la debilidad intrínseca que explotan los ataques DoS y DDoS por saturación de recursos.
              </p>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
              <h3 className="text-rose-400 font-semibold mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> La Ecuación Crítica de Ataque
              </h3>
              <p className="text-xs leading-relaxed text-slate-300 mb-2">
                Los clientes o balanceadores de carga tienen un límite de espera <strong>Timeout (T)</strong>. Si la latencia supera <span className="font-mono text-rose-300">T</span>, las conexiones se cancelan:
              </p>
              <div className="bg-slate-950 p-2.5 rounded font-mono text-xs text-center border border-slate-800 text-rose-300 my-2">
                f(λ) = W(λ) − T = 1 / (μ − λ) − T = 0
              </div>
              <p className="text-xs text-slate-400">
                La raíz de esta función, <span className="font-mono text-cyan-300">λ* = μ − 1/T</span>, es la tasa total exacta donde el servidor colapsa por timeout. El tráfico malicioso necesario para tumbar el servidor es:
              </p>
              <div className="bg-slate-950 p-2 rounded font-mono text-xs text-center text-amber-300 mt-2">
                λ_ataque = máx(0, λ* − λ_legítimo)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Newton-Raphson */}
      {activeTab === 'newton' && (
        <div className="space-y-4 text-sm text-slate-300">
          <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
            <h3 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Método de Newton-Raphson: Derivada Analítica y Defensa Activa
            </h3>
            <p className="text-xs leading-relaxed mb-3">
              Newton-Raphson utiliza el valor de la función y su <strong>derivada de primer orden</strong> para proyectar la tangente a la curva en cada paso:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-2 font-mono text-xs">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-200">
                <span className="text-slate-400">// Derivada exacta:</span><br />
                f'(λ) = 1 / (μ − λ)² &gt; 0
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-emerald-300">
                <span className="text-slate-400">// Paso de actualización:</span><br />
                λ_{'{k+1}'} = λ_k − [ f(λ_k) / f'(λ_k) ]
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-emerald-400 font-semibold block mb-1">Orden de Convergencia:</span>
                Cuadrático (p ≈ 2). El número de dígitos correctos aproximadamente se duplica en cada iteración.
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-emerald-400 font-semibold block mb-1">Analogía Ciberseguridad:</span>
                <strong>Modelo Caja Blanca</strong>: Conocemos la función de servicio exacta del servidor y calculamos derivadas instantáneas para ajustar reglas de rate-limiting.
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-emerald-400 font-semibold block mb-1">Costo Computacional:</span>
                Requiere 2 evaluaciones por paso (f y f'). Es extremadamente rápido si la derivada es económica.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Secant Method */}
      {activeTab === 'secante' && (
        <div className="space-y-4 text-sm text-slate-300">
          <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
            <h3 className="text-amber-400 font-semibold mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Método de la Secante: Telemetría de Caja Negra y Logs Empíricos
            </h3>
            <p className="text-xs leading-relaxed mb-3">
              En redes del mundo real, rara vez conocemos la fórmula matemática exacta del servidor. El método de la secante aproxima la pendiente usando <strong>dos muestras históricas consecutivas</strong>:
            </p>
            <div className="bg-slate-950 p-3 rounded font-mono text-xs text-amber-300 border border-slate-800 my-2 text-center">
              λ_{'{k+1}'} = λ_k − f(λ_k) · [ (λ_k − λ_{'{k-1}'}) / (f(λ_k) − f(λ_{'{k-1}'})) ]
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-amber-400 font-semibold block mb-1">Orden de Convergencia:</span>
                Superlineal (p ≈ 1.618, la proporción áurea φ). Ligeramente más pasos que Newton, pero sin calcular derivadas.
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-amber-400 font-semibold block mb-1">Analogía Ciberseguridad:</span>
                <strong>Modelo Caja Negra / Telemetría</strong>: Se alimenta directamente de métricas de Prometheus o logs de latencia medidos en dos instantes sin depender de la ecuación interna.
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-amber-400 font-semibold block mb-1">Costo Computacional:</span>
                Solo 1 nueva evaluación de f por iteración (reutiliza f_{'{k-1}'}). Muy eficiente cuando evaluar el sistema es costoso.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Comparison Matrix */}
      {activeTab === 'comparativa' && (
        <div className="space-y-4 text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/80 text-slate-300">
                  <th className="p-2.5">Característica</th>
                  <th className="p-2.5 text-emerald-400">Método de Newton-Raphson</th>
                  <th className="p-2.5 text-amber-400">Método de la Secante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="p-2.5 font-medium text-slate-200">Requerimiento de Derivada</td>
                  <td className="p-2.5 text-emerald-300">Sí (f'(λ) analítica o diferencia finita)</td>
                  <td className="p-2.5 text-amber-300">No (usa interpolación entre 2 puntos)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-slate-200">Orden de Convergencia</td>
                  <td className="p-2.5 font-mono">Cuadrático (p ≈ 2.0)</td>
                  <td className="p-2.5 font-mono">Superlineal (p ≈ 1.618)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-slate-200">Evaluaciones por iteración</td>
                  <td className="p-2.5">2 (f y f')</td>
                  <td className="p-2.5 font-semibold text-amber-300">1 (reutiliza f previa)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-slate-200">Puntos iniciales requeridos</td>
                  <td className="p-2.5">1 punto (x₀)</td>
                  <td className="p-2.5">2 puntos (x₀, x₁)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-slate-200">Comportamiento con Ruido/Logs</td>
                  <td className="p-2.5 text-slate-400">Sensible a gradientes ruidosos; requiere diferencias finitas</td>
                  <td className="p-2.5 text-emerald-300">Más natural para logs empíricos y telemetría de red</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-slate-200">Veredicto en Ciberseguridad</td>
                  <td className="p-2.5 text-emerald-300">Ideal cuando se cuenta con modelo matemático formal del cluster</td>
                  <td className="p-2.5 text-amber-300">Ideal cuando se mide latencia real desde sondas o balanceadores</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
