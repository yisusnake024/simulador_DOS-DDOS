import React from 'react';
import { X, BookMarked } from 'lucide-react';

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const terms = [
  {
    symbol: 'μ (Mu)',
    title: 'Tasa de Servicio / Capacidad del Servidor',
    desc: 'Número máximo promedio de solicitudes HTTP/TCP que el servidor puede procesar por segundo (req/s) cuando está al 100% de uso.',
  },
  {
    symbol: 'λ (Lambda)',
    title: 'Tasa de Llegada de Solicitudes',
    desc: 'Flujo de peticiones por segundo que entran al sistema. Incluye tanto el tráfico de usuarios legítimos como el de atacantes.',
  },
  {
    symbol: 'T (Timeout)',
    title: 'Tiempo Límite de Espera (Timeout)',
    desc: 'Tiempo máximo (en segundos o ms) que un cliente, navegador o proxy inverso está dispuesto a esperar antes de cancelar la conexión y reportar error 504 Gateway Timeout.',
  },
  {
    symbol: 'W(λ)',
    title: 'Tiempo Medio de Permanencia (Latencia)',
    desc: 'En el modelo M/M/1, W(λ) = 1 / (μ − λ). Modela el tiempo en cola más el tiempo de procesamiento. Tiende a infinito cuando λ se acerca a μ.',
  },
  {
    symbol: 'λ*',
    title: 'Umbral Crítico de Colapso',
    desc: 'Punto exacto donde la latencia del sistema alcanza el timeout: W(λ*) = T. Se calcula analíticamente como λ* = μ − 1/T.',
  },
  {
    symbol: 'λ_ataque',
    title: 'Tráfico DoS/DDoS Requerido',
    desc: 'Volumen mínimo de tráfico malicioso necesario para tumbar el servidor: λ_ataque = máx(0, λ* − λ_legítimo).',
  },
  {
    symbol: 'f(λ) y Residuo',
    title: 'Función Objetivo & Residuo',
    desc: 'f(λ) = W(λ) − T. El residuo es cuánto se aleja la latencia actual del timeout. El algoritmo busca que |f(λ)| < Tolerancia.',
  },
  {
    symbol: 'f\'(λ)',
    title: 'Derivada de la Función Objetivo',
    desc: 'Pendiente de la curva f\'(λ) = 1 / (μ − λ)². Indica qué tan rápido crece la latencia ante un incremento marginal en el tráfico.',
  },
  {
    symbol: 'Tolerancia (ε)',
    title: 'Criterio de Parada Numérico',
    desc: 'Precisión deseada (ej. 10⁻⁶). Si el error absoluto o cambio entre iteraciones es menor que este valor, el solver se detiene por convergencia exitosa.',
  },
  {
    symbol: 'Orden p',
    title: 'Orden de Convergencia',
    desc: 'Medida asintótica de la velocidad de reducción del error. Newton tiene p ≈ 2 (cuadrático), mientras que la Secante tiene p ≈ 1.618 (superlineal).',
  },
];

export const GlossaryModal: React.FC<GlossaryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5 text-slate-100 font-bold text-base">
            <BookMarked className="w-5 h-5 text-indigo-400" />
            Glosario Contextual de Términos
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-3 divide-y divide-slate-800/80 text-xs text-slate-300">
          {terms.map((t, idx) => (
            <div key={idx} className={idx > 0 ? 'pt-3' : ''}>
              <div className="flex items-center gap-2 font-mono text-cyan-300 font-bold mb-1">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  {t.symbol}
                </span>
                <span className="text-slate-100 font-sans">{t.title}</span>
              </div>
              <p className="text-slate-400 leading-relaxed pl-1">{t.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
