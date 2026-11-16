import { describe, it, expect } from 'vitest';
import {
  computeProbeStats,
  estimateCapacity,
  erlangCProbability,
  getModelLatency,
  getModelAnalyticalRoot,
  solveQueueThreshold,
  buildConvergenceSeries,
} from './queueModels';
import { validateTargetUrl } from './urlValidation';

describe('URL Validation & SSRF Guardrails', () => {
  it('accepts valid public HTTP/HTTPS URLs and normalizes missing scheme', () => {
    const res1 = validateTargetUrl('https://example.com');
    expect(res1.valid).toBe(true);
    expect(res1.normalizedUrl).toBe('https://example.com/');

    const res2 = validateTargetUrl('example.org/health');
    expect(res2.valid).toBe(true);
    expect(res2.normalizedUrl).toBe('https://example.org/health');
  });

  it('rejects localhost, private IPs, and non-HTTP schemes', () => {
    expect(validateTargetUrl('http://localhost:3000').valid).toBe(false);
    expect(validateTargetUrl('http://127.0.0.1:8080').valid).toBe(false);
    expect(validateTargetUrl('http://10.0.0.1').valid).toBe(false);
    expect(validateTargetUrl('http://192.168.1.10').valid).toBe(false);
    expect(validateTargetUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false);
    expect(validateTargetUrl('ftp://example.com/file').valid).toBe(false);
    expect(validateTargetUrl('').valid).toBe(false);
  });
});

describe('Baseline Probe Statistics & Capacity Estimation', () => {
  it('computes median S0, mean, stdDev, and CV accurately', () => {
    // 5 values: [0.10, 0.12, 0.14, 0.16, 0.48] -> median = 0.14, mean = 0.20
    const stats = computeProbeStats([0.48, 0.10, 0.14, 0.16, 0.12]);
    expect(stats.validSamples).toBe(5);
    expect(stats.medianS0).toBeCloseTo(0.14, 6);
    expect(stats.meanS).toBeCloseTo(0.20, 6);
    expect(stats.stdDevS).toBeGreaterThan(0);
    expect(stats.cv).toBeCloseTo(stats.stdDevS / stats.meanS, 6);
  });

  it('estimates mu_worker = 1/S0 and mu_total = c / S0', () => {
    const cap = estimateCapacity(0.1, 4); // S0 = 100ms, 4 workers
    expect(cap.muWorker).toBeCloseTo(10, 6);
    expect(cap.muTotal).toBeCloseTo(40, 6);
    expect(cap.workers).toBe(4);
  });
});

describe('Queueing Models (M/M/1, M/G/1, M/M/c)', () => {
  it('M/G/1 Pollaczek-Khinchine reduces identically to M/M/1 when CV = 1', () => {
    const mu = 40;
    for (const lambda of [0, 5, 15, 25, 35]) {
      const wMM1 = getModelLatency(lambda, { model: 'MM1', muTotal: mu, workers: 1, cv: 1 });
      const wMG1 = getModelLatency(lambda, { model: 'MG1', muTotal: mu, workers: 1, cv: 1 });
      expect(wMG1).toBeCloseTo(wMM1, 10);
    }
  });

  it('M/M/c Erlang C reduces identically to M/M/1 when c = 1', () => {
    const mu = 40;
    for (const lambda of [0, 5, 15, 25, 35]) {
      const wMM1 = getModelLatency(lambda, { model: 'MM1', muTotal: mu, workers: 1, cv: 1 });
      const wMMC = getModelLatency(lambda, { model: 'MMC', muTotal: mu, workers: 1, cv: 1 });
      expect(wMMC).toBeCloseTo(wMM1, 10);
    }
  });

  it('Erlang C stays numerically stable for c = 32 workers', () => {
    const prob = erlangCProbability(32, 24);
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThan(1);
    expect(Number.isFinite(prob)).toBe(true);
  });

  it('Newton-Raphson & Secant converge for M/M/1, M/G/1, and M/M/c (Erlang C)', () => {
    const T = 0.25; // 250 ms SLA
    const paramsBase = { muTotal: 40, workers: 4, cv: 0.35 };

    // M/M/1
    const solMM1 = solveQueueThreshold(T, { ...paramsBase, model: 'MM1' });
    expect(solMM1.feasible).toBe(true);
    expect(solMM1.newton.converged).toBe(true);
    expect(solMM1.secant.converged).toBe(true);
    expect(solMM1.newton.root).toBeCloseTo(solMM1.analyticalRoot!, 5);
    expect(solMM1.secant.root).toBeCloseTo(solMM1.analyticalRoot!, 5);

    // M/G/1
    const solMG1 = solveQueueThreshold(T, { ...paramsBase, model: 'MG1' });
    expect(solMG1.feasible).toBe(true);
    expect(solMG1.newton.converged).toBe(true);
    expect(solMG1.secant.converged).toBe(true);
    const analyticalMG1 = getModelAnalyticalRoot(T, { ...paramsBase, model: 'MG1' })!;
    expect(solMG1.newton.root).toBeCloseTo(analyticalMG1, 5);
    expect(solMG1.secant.root).toBeCloseTo(analyticalMG1, 5);

    // M/M/c (W(0) = c / muTotal = 4 / 40 = 0.1s < 0.25s)
    const solMMC = solveQueueThreshold(T, { ...paramsBase, model: 'MMC' }, { includeCrossModel: true });
    expect(solMMC.feasible).toBe(true);
    expect(solMMC.analyticalRoot).toBeNull();
    expect(solMMC.newton.converged).toBe(true);
    expect(solMMC.secant.converged).toBe(true);
    expect(solMMC.newton.root).toBeCloseTo(solMMC.secant.root, 4);
    expect(
      Math.abs(getModelLatency(solMMC.newton.root, { ...paramsBase, model: 'MMC' }) - T)
    ).toBeLessThan(1e-5);
  });

  it('detects infeasible SLA cleanly when T <= W(0)', () => {
    // S0 = 0.25s (muWorker = 4), c = 4 -> muTotal = 16, W(0) in MMC = 0.25s
    const sol = solveQueueThreshold(0.2, { model: 'MMC', muTotal: 16, workers: 4, cv: 0.2 });
    expect(sol.feasible).toBe(false);
    expect(sol.reason).toContain('umbral T');
  });

  it('builds convergence series with decreasing log10 error for Newton and Secant', () => {
    const sol = solveQueueThreshold(0.25, { model: 'MMC', muTotal: 40, workers: 4, cv: 0.3 });
    const series = buildConvergenceSeries(sol.newton, sol.secant);
    expect(series.length).toBe(Math.max(sol.newton.history.length, sol.secant.history.length));
    expect(series[0].k).toBe(0);
    expect(series[0].newtonLogErr).not.toBeNull();
    expect(series[0].secantLogErr).not.toBeNull();
    const lastNewton = series.filter((p) => p.newtonLogErr !== null).at(-1)!;
    expect(lastNewton.newtonLogErr!).toBeLessThan(series[0].newtonLogErr!);
  });
});

