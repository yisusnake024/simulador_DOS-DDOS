import { estimateOrder, Iteration, SolverResult } from './solvers';

export type QueueModelType = 'MM1' | 'MG1' | 'MMC';

export interface ProbeStats {
  totalSamples: number;
  validSamples: number;
  medianS0: number; // Median latency in seconds
  meanS: number; // Mean latency in seconds
  stdDevS: number; // Sample standard deviation in seconds
  cv: number; // Coefficient of variation (stdDevS / meanS)
  minS: number;
  maxS: number;
}

export interface CapacityEstimate {
  muWorker: number; // 1 / S0 (req/s per worker)
  muTotal: number; // c * muWorker = c / S0 (req/s total)
  workers: number; // c
}

export interface QueueModelParams {
  model: QueueModelType;
  muTotal: number;
  workers: number;
  cv: number;
}

export interface QueueThresholdSolution {
  feasible: boolean;
  reason?: string;
  baseLatencyZero: number; // W(0) in seconds
  analyticalRoot: number | null; // Closed-form root if available (MM1, MG1), null for MMC
  newton: SolverResult;
  secant: SolverResult;
  comparison?: {
    mm1Root: number | null;
    mg1Root: number | null;
    mmcRoot: number | null;
  };
}

/**
 * Step 1: Compute baseline probing statistics (median S0, mean, stdDev, CV).
 * Input latencies must be positive numbers in seconds.
 */
export function computeProbeStats(latenciesSec: number[]): ProbeStats {
  const valid = latenciesSec.filter((v) => Number.isFinite(v) && v > 0);
  const n = valid.length;

  if (n === 0) {
    return {
      totalSamples: latenciesSec.length,
      validSamples: 0,
      medianS0: 0,
      meanS: 0,
      stdDevS: 0,
      cv: 0,
      minS: 0,
      maxS: 0,
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const medianS0 = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const sum = valid.reduce((acc, v) => acc + v, 0);
  const meanS = sum / n;

  const variance =
    n > 1
      ? valid.reduce((acc, v) => acc + Math.pow(v - meanS, 2), 0) / (n - 1)
      : 0;
  const stdDevS = Math.sqrt(variance);
  const cv = meanS > 0 ? stdDevS / meanS : 0;

  return {
    totalSamples: latenciesSec.length,
    validSamples: n,
    medianS0,
    meanS,
    stdDevS,
    cv,
    minS: sorted[0],
    maxS: sorted[n - 1],
  };
}

/**
 * Step 2: Estimate per-worker and total server capacity from median baseline S0.
 */
export function estimateCapacity(medianS0: number, workers: number): CapacityEstimate {
  const c = Math.max(1, Math.round(workers));
  if (!Number.isFinite(medianS0) || medianS0 <= 0) {
    return { muWorker: 0, muTotal: 0, workers: c };
  }
  const muWorker = 1 / medianS0;
  const muTotal = c * muWorker;
  return { muWorker, muTotal, workers: c };
}

/**
 * Computes Erlang C waiting probability C(c, a) in a numerically stable way
 * using term recurrence (avoids factorial overflow for large c).
 * Requires rho = a / c < 1.
 */
export function erlangCProbability(c: number, offeredLoadA: number): number {
  const workers = Math.max(1, Math.round(c));
  const rho = offeredLoadA / workers;
  if (rho >= 1) return 1;
  if (offeredLoadA <= 0) return 0;

  // t_0 = 1, t_k = t_{k-1} * (a / k)
  let term = 1;
  let sumPrefix = 1;
  for (let k = 1; k < workers; k++) {
    term = term * (offeredLoadA / k);
    sumPrefix += term;
  }

  // Last term for k = c: (a^c / c!) * (1 / (1 - rho))
  const lastTerm = term * (offeredLoadA / workers) * (1 / (1 - rho));
  const p0 = 1 / (sumPrefix + lastTerm);
  return Math.min(1, Math.max(0, lastTerm * p0));
}

/**
 * Step 3: Expected response time W(λ) in seconds for MM1, MG1, or MMC.
 */
export function getModelLatency(lambda: number, params: QueueModelParams): number {
  const { model, muTotal, workers, cv } = params;
  if (muTotal <= 0) return Infinity;
  if (lambda >= muTotal) return Infinity;
  const safeLambda = Math.max(0, lambda);

  if (model === 'MM1') {
    return 1 / (muTotal - safeLambda);
  }

  if (model === 'MG1') {
    // Pollaczek-Khinchine: W(λ) = [λ(1 + CV²)] / [2μ(μ - λ)] + 1/μ
    return (
      (safeLambda * (1 + cv * cv)) / (2 * muTotal * (muTotal - safeLambda)) +
      1 / muTotal
    );
  }

  // MMC (Erlang C) with c workers, each at rate muWorker = muTotal / c
  const c = Math.max(1, Math.round(workers));
  const muWorker = muTotal / c;
  const offeredLoadA = safeLambda / muWorker; // a = λ / μ_worker = c * ρ
  const probWait = erlangCProbability(c, offeredLoadA);
  const wq = probWait / (muTotal - safeLambda);
  return wq + 1 / muWorker;
}

/**
 * Derivative dW/dλ = f'(λ) for the selected queueing model.
 */
export function getModelDerivative(lambda: number, params: QueueModelParams): number {
  const { model, muTotal, cv } = params;
  if (lambda >= muTotal || muTotal <= 0) return Infinity;

  if (model === 'MM1') {
    return 1 / Math.pow(muTotal - lambda, 2);
  }

  if (model === 'MG1') {
    return (1 + cv * cv) / (2 * Math.pow(muTotal - lambda, 2));
  }

  // Central finite differences for M/M/c Erlang C
  const margin = Math.min(lambda, muTotal - lambda);
  const h = Math.max(1e-7, Math.min(muTotal * 1e-4, margin * 0.25));
  const fPlus = getModelLatency(lambda + h, params);
  const fMinus = getModelLatency(Math.max(0, lambda - h), params);
  const actualSpan = (lambda + h) - Math.max(0, lambda - h);
  if (!isFinite(fPlus) || !isFinite(fMinus) || actualSpan <= 0) {
    return 1 / Math.pow(muTotal - lambda, 2);
  }
  return (fPlus - fMinus) / actualSpan;
}

/**
 * Closed-form root λ* where W(λ*) = T, when an elementary formula exists.
 * Returns null for M/M/c (requires numerical solver) or if T <= W(0).
 */
export function getModelAnalyticalRoot(T: number, params: QueueModelParams): number | null {
  const { model, muTotal, cv } = params;
  if (muTotal <= 0 || T <= 0) return null;

  const baseZero = getModelLatency(0, params);
  if (T <= baseZero) return null;

  if (model === 'MM1') {
    return muTotal - 1 / T;
  }

  if (model === 'MG1') {
    // λ(1 + CV²) / [2μ(μ - λ)] = T - 1/μ  =>  k = (1 + CV²)/2
    // λ* = μ * (Tμ - 1) / (Tμ - 1 + (1 + CV²)/2)
    const tm = T * muTotal - 1;
    if (tm <= 0) return null;
    const k = (1 + cv * cv) / 2;
    return (muTotal * tm) / (tm + k);
  }

  // M/M/c with Erlang C has no closed-form root
  return null;
}

function runNewtonForModel(
  T: number,
  params: QueueModelParams,
  x0: number,
  tolerance: number,
  maxIterations: number,
  analytical: number | null
): SolverResult {
  const history: Iteration[] = [];
  const mu = params.muTotal;
  let x = Math.min(Math.max(1e-6, x0), mu * 0.99);
  let evalF = 0;
  let evalDf = 0;

  for (let k = 0; k < maxIterations; k++) {
    if (x >= mu) {
      return {
        methodName: 'Newton-Raphson',
        history,
        root: history[history.length - 1]?.x ?? x,
        reason: 'Dominio inválido (λ ≥ μ)',
        converged: false,
        totalEvaluations: evalF + evalDf,
        evaluationsF: evalF,
        evaluationsDfx: evalDf,
        iterationsCount: history.length,
        finalErrorAbs: history[history.length - 1]?.errorAbs ?? Infinity,
        finalErrorReal: history[history.length - 1]?.errorReal ?? null,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    const w = getModelLatency(x, params);
    const fx = w - T;
    evalF++;

    const dfx = getModelDerivative(x, params);
    if (params.model === 'MMC') {
      evalF += 2; // central finite difference uses 2 extra f evaluations
    } else {
      evalDf++;
    }

    const errorAbs = Math.abs(fx);
    const errorReal = analytical !== null ? Math.abs(x - analytical) : null;
    const dir = fx < 0 ? 'por debajo del SLA; avanza a mayor tráfico' : 'excede el SLA; retrocede hacia el umbral';

    history.push({
      k,
      x,
      fx,
      dfx,
      errorAbs,
      errorReal,
      stepExplanation: `Paso ${k} (${params.model}): λ = ${x.toFixed(3)} req/s → W(λ) = ${(w * 1000).toFixed(2)} ms vs SLA ${(T * 1000).toFixed(0)} ms. Residuo f(λ) = ${fx.toFixed(5)} (${dir}).`,
    });

    if (errorAbs < tolerance) {
      return {
        methodName: 'Newton-Raphson',
        history,
        root: x,
        reason: 'Convergencia alcanzada (|f(λ)| < tolerancia)',
        converged: true,
        totalEvaluations: evalF + evalDf,
        evaluationsF: evalF,
        evaluationsDfx: evalDf,
        iterationsCount: history.length,
        finalErrorAbs: errorAbs,
        finalErrorReal: errorReal,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    if (!isFinite(dfx) || Math.abs(dfx) < 1e-14) {
      return {
        methodName: 'Newton-Raphson',
        history,
        root: x,
        reason: 'Derivada nula o infinita',
        converged: false,
        totalEvaluations: evalF + evalDf,
        evaluationsF: evalF,
        evaluationsDfx: evalDf,
        iterationsCount: history.length,
        finalErrorAbs: errorAbs,
        finalErrorReal: errorReal,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    let nextX = x - fx / dfx;
    if (nextX >= mu) {
      nextX = x + 0.75 * (mu - x);
    } else if (nextX <= 0) {
      nextX = x * 0.5;
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
    totalEvaluations: evalF + evalDf,
    evaluationsF: evalF,
    evaluationsDfx: evalDf,
    iterationsCount: history.length,
    finalErrorAbs: last?.errorAbs ?? Infinity,
    finalErrorReal: last?.errorReal ?? null,
    estimatedConvergenceOrder: estimateOrder(history),
  };
}

function runSecantForModel(
  T: number,
  params: QueueModelParams,
  x0: number,
  x1: number,
  tolerance: number,
  maxIterations: number,
  analytical: number | null
): SolverResult {
  const history: Iteration[] = [];
  const mu = params.muTotal;
  let xPrev = Math.min(Math.max(1e-6, x0), mu * 0.98);
  let xCurr = Math.min(Math.max(2e-6, x1), mu * 0.99);
  if (Math.abs(xCurr - xPrev) < 1e-5) {
    xCurr = Math.min(mu * 0.99, xPrev + mu * 0.05);
  }

  let evalF = 0;
  let fPrev = getModelLatency(xPrev, params) - T;
  evalF++;

  for (let k = 0; k < maxIterations; k++) {
    if (xCurr >= mu || xPrev >= mu) {
      return {
        methodName: 'Secante',
        history,
        root: history[history.length - 1]?.x ?? xCurr,
        reason: 'Dominio inválido (λ ≥ μ)',
        converged: false,
        totalEvaluations: evalF,
        evaluationsF: evalF,
        evaluationsDfx: 0,
        iterationsCount: history.length,
        finalErrorAbs: history[history.length - 1]?.errorAbs ?? Infinity,
        finalErrorReal: history[history.length - 1]?.errorReal ?? null,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    const w = getModelLatency(xCurr, params);
    const fCurr = w - T;
    evalF++;

    const errorAbs = Math.abs(fCurr);
    const errorReal = analytical !== null ? Math.abs(xCurr - analytical) : null;

    history.push({
      k,
      x: xCurr,
      fx: fCurr,
      errorAbs,
      errorReal,
      stepExplanation: `Paso ${k} (${params.model}): Interpolación secante entre λ₀=${xPrev.toFixed(2)} y λ₁=${xCurr.toFixed(2)} → W = ${(w * 1000).toFixed(2)} ms, residuo f(λ) = ${fCurr.toFixed(5)}.`,
    });

    if (errorAbs < tolerance) {
      return {
        methodName: 'Secante',
        history,
        root: xCurr,
        reason: 'Convergencia alcanzada (|f(λ)| < tolerancia)',
        converged: true,
        totalEvaluations: evalF,
        evaluationsF: evalF,
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
        reason: 'Divergencia (denominador nulo)',
        converged: false,
        totalEvaluations: evalF,
        evaluationsF: evalF,
        evaluationsDfx: 0,
        iterationsCount: history.length,
        finalErrorAbs: errorAbs,
        finalErrorReal: errorReal,
        estimatedConvergenceOrder: estimateOrder(history),
      };
    }

    let xNext = xCurr - fCurr * ((xCurr - xPrev) / denom);
    if (xNext >= mu) {
      xNext = xCurr + 0.75 * (mu - xCurr);
    } else if (xNext <= 0) {
      xNext = xCurr * 0.5;
    }

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
    totalEvaluations: evalF,
    evaluationsF: evalF,
    evaluationsDfx: 0,
    iterationsCount: history.length,
    finalErrorAbs: last?.errorAbs ?? Infinity,
    finalErrorReal: last?.errorReal ?? null,
    estimatedConvergenceOrder: estimateOrder(history),
  };
}

/**
 * Step 4: Solve W(λ*) = T using Newton-Raphson and Secant for the active model,
 * and optionally compute cross-model roots for side-by-side comparison.
 */
export function solveQueueThreshold(
  T: number,
  params: QueueModelParams,
  options?: { tolerance?: number; maxIterations?: number; includeCrossModel?: boolean }
): QueueThresholdSolution {
  const tolerance = options?.tolerance ?? 1e-6;
  const maxIterations = options?.maxIterations ?? 60;
  const baseZero = getModelLatency(0, params);

  if (!Number.isFinite(T) || T <= 0 || params.muTotal <= 0) {
    const emptyNewton = runNewtonForModel(T, params, 0, tolerance, 0, null);
    const emptySecant = runSecantForModel(T, params, 0, 0, tolerance, 0, null);
    return {
      feasible: false,
      reason: 'Parámetros inválidos (T y μ deben ser positivos).',
      baseLatencyZero: baseZero,
      analyticalRoot: null,
      newton: emptyNewton,
      secant: emptySecant,
    };
  }

  if (T <= baseZero) {
    const emptyNewton: SolverResult = {
      methodName: 'Newton-Raphson',
      history: [],
      root: 0,
      reason: `SLA inalcanzable: T (${(T * 1000).toFixed(1)} ms) ≤ latencia base W(0) (${(baseZero * 1000).toFixed(1)} ms)`,
      converged: false,
      totalEvaluations: 0,
      evaluationsF: 0,
      evaluationsDfx: 0,
      iterationsCount: 0,
      finalErrorAbs: Math.abs(baseZero - T),
      finalErrorReal: null,
      estimatedConvergenceOrder: null,
    };
    const emptySecant: SolverResult = {
      ...emptyNewton,
      methodName: 'Secante',
    };
    return {
      feasible: false,
      reason: `El umbral T (${(T * 1000).toFixed(1)} ms) es menor o igual a la latencia en vacío W(0) (${(baseZero * 1000).toFixed(1)} ms). Selecciona T > W(0), por ejemplo 2×S₀.`,
      baseLatencyZero: baseZero,
      analyticalRoot: null,
      newton: emptyNewton,
      secant: emptySecant,
    };
  }

  const analytical = getModelAnalyticalRoot(T, params);
  const x0N = params.muTotal * 0.5;
  const x0S = params.muTotal * 0.45;
  const x1S = params.muTotal * 0.6;

  const newton = runNewtonForModel(T, params, x0N, tolerance, maxIterations, analytical);
  const secant = runSecantForModel(T, params, x0S, x1S, tolerance, maxIterations, analytical);

  let comparison: QueueThresholdSolution['comparison'];
  if (options?.includeCrossModel) {
    const solveRootFor = (m: QueueModelType): number | null => {
      const p: QueueModelParams = { ...params, model: m };
      if (T <= getModelLatency(0, p)) return null;
      const a = getModelAnalyticalRoot(T, p);
      if (a !== null) return a;
      const res = runSecantForModel(T, p, p.muTotal * 0.45, p.muTotal * 0.6, tolerance, maxIterations, null);
      return res.converged ? res.root : null;
    };
    comparison = {
      mm1Root: solveRootFor('MM1'),
      mg1Root: solveRootFor('MG1'),
      mmcRoot: solveRootFor('MMC'),
    };
  }

  return {
    feasible: true,
    baseLatencyZero: baseZero,
    analyticalRoot: analytical,
    newton,
    secant,
    comparison,
  };
}

export interface ConvergencePoint {
  k: number;
  newtonLogErr: number | null;
  secantLogErr: number | null;
  newtonErrAbs: number | null;
  secantErrAbs: number | null;
  newtonLambda: number | null;
  secantLambda: number | null;
}

/**
 * Builds a unified iteration series comparing log10(|f(λ)|) residual decay
 * between Newton-Raphson and Secant methods.
 */
export function buildConvergenceSeries(
  newton: SolverResult,
  secant: SolverResult
): ConvergencePoint[] {
  const maxLen = Math.max(newton.history.length, secant.history.length);
  const points: ConvergencePoint[] = [];

  for (let k = 0; k < maxLen; k++) {
    const nIt = newton.history[k];
    const sIt = secant.history[k];
    points.push({
      k,
      newtonLogErr: nIt ? Number(Math.log10(Math.max(nIt.errorAbs, 1e-12)).toFixed(3)) : null,
      secantLogErr: sIt ? Number(Math.log10(Math.max(sIt.errorAbs, 1e-12)).toFixed(3)) : null,
      newtonErrAbs: nIt ? nIt.errorAbs : null,
      secantErrAbs: sIt ? sIt.errorAbs : null,
      newtonLambda: nIt ? nIt.x : null,
      secantLambda: sIt ? sIt.x : null,
    });
  }

  return points;
}

