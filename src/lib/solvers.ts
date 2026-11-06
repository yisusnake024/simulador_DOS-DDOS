import { objectiveFunction, objectiveDerivative, getAnalyticalRoot, getLatency } from './mm1';

export interface Iteration {
  k: number;
  x: number;
  fx: number;
  dfx?: number;
  errorAbs: number;
  errorReal: number | null;
  stepExplanation: string;
}

export interface SolverResult {
  methodName: 'Newton-Raphson' | 'Secante';
  history: Iteration[];
  root: number;
  reason: string;
  converged: boolean;
  totalEvaluations: number;
  evaluationsF: number;
  evaluationsDfx: number;
  iterationsCount: number;
  finalErrorAbs: number;
  finalErrorReal: number | null;
  estimatedConvergenceOrder: number | null;
  executionTimeMs?: number;
}

export interface SolverOptions {
  tolerance?: number;
  maxIterations?: number;
  useNoise?: boolean;
  noiseSigma?: number; // e.g. 0.05 = 5% noise
  noiseSeed?: number;
}

/**
 * Deterministic PRNG using Mulberry32
 */
export function createPrng(seed: number) {
  let s = (seed >>> 0) || 123456789;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller Gaussian sample generator with zero mean and given sigma
 */
export function nextGaussian(rng: () => number, sigma: number): number {
  if (sigma <= 0) return 0;
  const u1 = Math.max(1e-15, rng());
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * sigma;
}

/**
 * Evaluates objective function f(λ), optionally with multiplicative telemetry noise:
 * W_noise(λ) = W(λ) * (1 + N(0, σ²))
 * f_noise(λ) = W_noise(λ) - T
 */
function evaluateF(
  lambda: number,
  mu: number,
  T: number,
  noiseOpts?: { useNoise?: boolean; noiseSigma?: number; rng?: () => number }
): { fx: number; rawW: number } {
  const rawW = getLatency(lambda, mu);
  if (!isFinite(rawW)) return { fx: Infinity, rawW: Infinity };

  if (noiseOpts?.useNoise && noiseOpts.noiseSigma && noiseOpts.noiseSigma > 0 && noiseOpts.rng) {
    const noise = nextGaussian(noiseOpts.rng, noiseOpts.noiseSigma);
    const noisyW = Math.max(1e-6, rawW * (1 + noise));
    return { fx: noisyW - T, rawW: noisyW };
  }
  return { fx: rawW - T, rawW };
}

/**
 * Estimates the empirical order of convergence p from the last iterations:
 * p ≈ ln(e_k / e_{k-1}) / ln(e_{k-1} / e_{k-2})
 */
export function estimateOrder(history: Iteration[]): number | null {
  if (history.length < 4) return null;
  const errors = history
    .map(h => (h.errorReal !== null && h.errorReal > 1e-13 ? h.errorReal : h.errorAbs))
    .filter(e => e > 1e-14);

  if (errors.length < 3) return null;

  const eK = errors[errors.length - 1];
  const eK1 = errors[errors.length - 2];
  const eK2 = errors[errors.length - 3];

  const ratio1 = eK / eK1;
  const ratio2 = eK1 / eK2;

  if (ratio1 <= 0 || ratio2 <= 0 || Math.abs(ratio2 - 1) < 1e-6) return null;

  const p = Math.log(ratio1) / Math.log(ratio2);
  if (p <= 0 || p > 4 || !isFinite(p)) return null;
  return Number(p.toFixed(3));
}

/**
 * Solves f(λ) = 1/(μ-λ) - T = 0 using Newton-Raphson
 */
export const newtonRaphson = (
  mu: number,
  T: number,
  x0: number,
  tolerance = 1e-6,
  maxIterations = 50,
  analyticalRoot: number | null = null,
  options: SolverOptions = {}
): SolverResult => {
  const history: Iteration[] = [];
  const rng = options.useNoise ? createPrng(options.noiseSeed ?? 42) : undefined;
  const analytical = analyticalRoot ?? getAnalyticalRoot(mu, T);

  let x = Math.min(x0, mu - 1e-3);
  let evaluationsF = 0;
  let evaluationsDfx = 0;

  for (let k = 0; k < maxIterations; k++) {
    if (x >= mu) {
      return {
        methodName: 'Newton-Raphson',
        history,
        root: history[history.length - 1]?.x ?? x,
        reason: 'Dominio inválido (λ ≥ μ: el servidor colapsa)',
        converged: false,
        totalEvaluations: evaluationsF + evaluationsDfx,
        evaluationsF,
        evaluationsDfx,
        iterationsCount: history.length,
        finalErrorAbs: history[history.length - 1]?.errorAbs ?? Infinity,
        finalErrorReal: history[history.length - 1]?.errorReal ?? null,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    const { fx, rawW } = evaluateF(x, mu, T, {
      useNoise: options.useNoise,
      noiseSigma: options.noiseSigma,
      rng,
    });
    evaluationsF++;

    // When noise is active, simulate numeric finite difference for defense / black-box telemetry
    let dfx: number;
    if (options.useNoise) {
      const h = Math.max(1e-4, (mu - x) * 1e-3);
      const { fx: fxPlus } = evaluateF(x + h, mu, T, {
        useNoise: options.useNoise,
        noiseSigma: options.noiseSigma,
        rng,
      });
      evaluationsF++;
      dfx = (fxPlus - fx) / h;
    } else {
      dfx = objectiveDerivative(x, mu);
      evaluationsDfx++;
    }

    const errorAbs = Math.abs(fx);
    const errorReal = analytical !== null ? Math.abs(x - analytical) : null;

    let explanation = `Paso ${k}: Se evalúa λ = ${x.toFixed(2)} req/s. Latencia W = ${(rawW * 1000).toFixed(2)} ms (Timeout: ${(T * 1000).toFixed(0)} ms). `;
    if (fx < 0) {
      explanation += `Residuo f(λ) = ${fx.toFixed(4)} < 0 (la latencia aún no supera el timeout; el servidor soporta más tráfico). Newton proyecta una recta tangente con pendiente f' = ${dfx.toFixed(6)} y avanza hacia la derecha.`;
    } else {
      explanation += `Residuo f(λ) = ${fx.toFixed(4)} > 0 (la latencia excede el timeout; el servidor ya superó el límite crítico). Newton retrocede hacia la izquierda para buscar el umbral exacto.`;
    }

    history.push({ k, x, fx, dfx, errorAbs, errorReal, stepExplanation: explanation });

    if (errorAbs < tolerance) {
      return {
        methodName: 'Newton-Raphson',
        history,
        root: x,
        reason: 'Convergencia alcanzada (|f(λ)| < tolerancia)',
        converged: true,
        totalEvaluations: evaluationsF + evaluationsDfx,
        evaluationsF,
        evaluationsDfx,
        iterationsCount: history.length,
        finalErrorAbs: errorAbs,
        finalErrorReal: errorReal,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    if (Math.abs(dfx) < 1e-14) {
      return {
        methodName: 'Newton-Raphson',
        history,
        root: x,
        reason: 'Divergencia (derivada cercana a cero)',
        converged: false,
        totalEvaluations: evaluationsF + evaluationsDfx,
        evaluationsF,
        evaluationsDfx,
        iterationsCount: history.length,
        finalErrorAbs: errorAbs,
        finalErrorReal: errorReal,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    // Standard Newton step: delta = fx / dfx
    const rawStep = fx / dfx;
    let nextX = x - rawStep;

    // Safety damping to protect the physical asymptote domain λ < μ:
    if (nextX >= mu) {
      // Step halving / geometric damping towards mu
      nextX = x + 0.75 * (mu - x);
    } else if (nextX < 0) {
      nextX = 0;
    }

    x = nextX;
  }

  const last = history[history.length - 1];
  return {
    methodName: 'Newton-Raphson',
    history,
    root: last?.x ?? x,
    reason: 'Límite de iteraciones alcanzado',
    converged: false,
    totalEvaluations: evaluationsF + evaluationsDfx,
    evaluationsF,
    evaluationsDfx,
    iterationsCount: history.length,
    finalErrorAbs: last?.errorAbs ?? Infinity,
    finalErrorReal: last?.errorReal ?? null,
    estimatedConvergenceOrder: estimateOrder(history),
  };
};

/**
 * Solves f(λ) = 1/(μ-λ) - T = 0 using the Secant Method
 */
export const secantMethod = (
  mu: number,
  T: number,
  x0: number,
  x1: number,
  tolerance = 1e-6,
  maxIterations = 50,
  analyticalRoot: number | null = null,
  options: SolverOptions = {}
): SolverResult => {
  const history: Iteration[] = [];
  const rng = options.useNoise ? createPrng((options.noiseSeed ?? 42) + 100) : undefined;
  const analytical = analyticalRoot ?? getAnalyticalRoot(mu, T);

  let xPrev = Math.min(x0, mu - 1e-3);
  let xCurr = Math.min(x1, mu - 1e-3);
  let evaluationsF = 0;

  // Initial evaluation for xPrev
  const { fx: fPrevInitial } = evaluateF(xPrev, mu, T, {
    useNoise: options.useNoise,
    noiseSigma: options.noiseSigma,
    rng,
  });
  evaluationsF++;
  let fPrev = fPrevInitial;

  for (let k = 0; k < maxIterations; k++) {
    if (xCurr >= mu || xPrev >= mu) {
      return {
        methodName: 'Secante',
        history,
        root: history[history.length - 1]?.x ?? xCurr,
        reason: 'Dominio inválido (λ ≥ μ: el servidor colapsa)',
        converged: false,
        totalEvaluations: evaluationsF,
        evaluationsF,
        evaluationsDfx: 0,
        iterationsCount: history.length,
        finalErrorAbs: history[history.length - 1]?.errorAbs ?? Infinity,
        finalErrorReal: history[history.length - 1]?.errorReal ?? null,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    const { fx: fCurr, rawW } = evaluateF(xCurr, mu, T, {
      useNoise: options.useNoise,
      noiseSigma: options.noiseSigma,
      rng,
    });
    evaluationsF++; // Notice: Only 1 new evaluation per step (reusing fPrev from prior step!)

    const errorAbs = Math.abs(fCurr);
    const errorReal = analytical !== null ? Math.abs(xCurr - analytical) : null;

    let explanation = `Paso ${k}: Se evalúa λ = ${xCurr.toFixed(2)} req/s con telemetría de latencia W = ${(rawW * 1000).toFixed(2)} ms. `;
    explanation += `La secante traza una recta entre los dos últimos puntos medidos (λ₀=${xPrev.toFixed(1)}, λ₁=${xCurr.toFixed(1)}). Sin requerir derivada analítica, aproxima la raíz por interpolación lineal.`;

    history.push({ k, x: xCurr, fx: fCurr, errorAbs, errorReal, stepExplanation: explanation });

    if (errorAbs < tolerance) {
      return {
        methodName: 'Secante',
        history,
        root: xCurr,
        reason: 'Convergencia alcanzada (|f(λ)| < tolerancia)',
        converged: true,
        totalEvaluations: evaluationsF,
        evaluationsF,
        evaluationsDfx: 0,
        iterationsCount: history.length,
        finalErrorAbs: errorAbs,
        finalErrorReal: errorReal,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    const denom = fCurr - fPrev;
    if (Math.abs(denom) < 1e-14) {
      return {
        methodName: 'Secante',
        history,
        root: xCurr,
        reason: 'Divergencia (f(x_k) == f(x_{k-1}); división por cero)',
        converged: false,
        totalEvaluations: evaluationsF,
        evaluationsF,
        evaluationsDfx: 0,
        iterationsCount: history.length,
        finalErrorAbs: errorAbs,
        finalErrorReal: errorReal,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    // Standard Secant formula
    let xNext = xCurr - fCurr * ((xCurr - xPrev) / denom);

    // Asymptote safety damping
    if (xNext >= mu) {
      xNext = xCurr + 0.75 * (mu - xCurr);
    } else if (xNext < 0) {
      xNext = 0;
    }

    // Shift variables for next step (fCurr becomes fPrev without re-evaluation!)
    xPrev = xCurr;
    fPrev = fCurr;
    xCurr = xNext;
  }

  const last = history[history.length - 1];
  return {
    methodName: 'Secante',
    history,
    root: last?.x ?? xCurr,
    reason: 'Límite de iteraciones alcanzado',
    converged: false,
    totalEvaluations: evaluationsF,
    evaluationsF,
    evaluationsDfx: 0,
    iterationsCount: history.length,
    finalErrorAbs: last?.errorAbs ?? Infinity,
    finalErrorReal: last?.errorReal ?? null,
    estimatedConvergenceOrder: estimateOrder(history),
  };
};

/**
 * Runs a performance benchmark executing both solvers multiple times
 */
export function benchmarkSolvers(
  mu: number,
  T: number,
  x0Newton: number,
  x0Secant: number,
  x1Secant: number,
  runs = 10000
): {
  runs: number;
  newtonTimeTotalMs: number;
  newtonAvgMicroseconds: number;
  secantTimeTotalMs: number;
  secantAvgMicroseconds: number;
  speedRatio: number; // e.g., Newton is X times faster or slower
  fasterMethod: 'Newton-Raphson' | 'Secante';
  newtonIterations: number;
  secantIterations: number;
  newtonEvals: number;
  secantEvals: number;
} {
  const analytical = getAnalyticalRoot(mu, T);
  const tol = 1e-6;
  const maxIt = 50;

  // Warmup run
  const warmupNewton = newtonRaphson(mu, T, x0Newton, tol, maxIt, analytical);
  const warmupSecant = secantMethod(mu, T, x0Secant, x1Secant, tol, maxIt, analytical);

  // Measure Newton-Raphson
  const t0Newton = performance.now();
  for (let i = 0; i < runs; i++) {
    newtonRaphson(mu, T, x0Newton, tol, maxIt, analytical);
  }
  const t1Newton = performance.now();
  const newtonTotal = t1Newton - t0Newton;

  // Measure Secant
  const t0Secant = performance.now();
  for (let i = 0; i < runs; i++) {
    secantMethod(mu, T, x0Secant, x1Secant, tol, maxIt, analytical);
  }
  const t1Secant = performance.now();
  const secantTotal = t1Secant - t0Secant;

  const newtonAvgUs = (newtonTotal / runs) * 1000;
  const secantAvgUs = (secantTotal / runs) * 1000;

  const faster = newtonTotal <= secantTotal ? 'Newton-Raphson' : 'Secante';
  const ratio = newtonTotal <= secantTotal ? secantTotal / Math.max(1e-6, newtonTotal) : newtonTotal / Math.max(1e-6, secantTotal);

  return {
    runs,
    newtonTimeTotalMs: Number(newtonTotal.toFixed(2)),
    newtonAvgMicroseconds: Number(newtonAvgUs.toFixed(3)),
    secantTimeTotalMs: Number(secantTotal.toFixed(2)),
    secantAvgMicroseconds: Number(secantAvgUs.toFixed(3)),
    speedRatio: Number(ratio.toFixed(2)),
    fasterMethod: faster,
    newtonIterations: warmupNewton.iterationsCount,
    secantIterations: warmupSecant.iterationsCount,
    newtonEvals: warmupNewton.totalEvaluations,
    secantEvals: warmupSecant.totalEvaluations,
  };
}
