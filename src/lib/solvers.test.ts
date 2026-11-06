import { describe, it, expect } from 'vitest';
import { newtonRaphson, secantMethod, benchmarkSolvers } from './solvers';
import { getAnalyticalRoot, getLatency, objectiveFunction, getAttackThreshold } from './mm1';

describe('M/M/1 Model & Solvers', () => {
  const mu = 1000;
  const T = 0.5;
  const analyticalRoot = getAnalyticalRoot(mu, T);
  const tolerance = 1e-6;
  const maxIterations = 50;

  it('calculates analytical root correctly: λ* = μ - 1/T', () => {
    // 1000 - 1/0.5 = 1000 - 2 = 998
    expect(analyticalRoot).toBe(998);
    // At root, latency should equal T
    expect(getLatency(analyticalRoot, mu)).toBeCloseTo(T, 5);
    expect(objectiveFunction(analyticalRoot, mu, T)).toBeCloseTo(0, 5);
  });

  it('calculates attack threshold λ_ataque = max(0, λ* - λ_legitimo)', () => {
    const resNormal = getAttackThreshold(998, 300);
    expect(resNormal.attackRate).toBe(698);
    expect(resNormal.serverOverloadedByLegit).toBe(false);

    const resOverloaded = getAttackThreshold(998, 1050);
    expect(resOverloaded.attackRate).toBe(0);
    expect(resOverloaded.serverOverloadedByLegit).toBe(true);
  });

  it('Newton-Raphson converges cleanly and respects domain', () => {
    const result = newtonRaphson(mu, T, 800, tolerance, maxIterations, analyticalRoot);
    expect(result.converged).toBe(true);
    expect(result.reason).toContain('Convergencia alcanzada');
    expect(Math.abs(result.root - analyticalRoot)).toBeLessThan(1e-4);
    expect(result.history.length).toBeGreaterThan(0);
  });

  it('Secant method converges cleanly', () => {
    const result = secantMethod(mu, T, 800, 850, tolerance, maxIterations, analyticalRoot);
    expect(result.converged).toBe(true);
    expect(result.reason).toContain('Convergencia alcanzada');
    expect(Math.abs(result.root - analyticalRoot)).toBeLessThan(1e-4);
  });

  it('solvers handle noisy telemetry deterministically', () => {
    const noisyNewton = newtonRaphson(mu, T, 850, 1e-2, 30, analyticalRoot, {
      useNoise: true,
      noiseSigma: 0.02,
      noiseSeed: 1234,
    });
    expect(noisyNewton.history.length).toBeGreaterThan(0);

    const noisySecant = secantMethod(mu, T, 850, 900, 1e-2, 30, analyticalRoot, {
      useNoise: true,
      noiseSigma: 0.02,
      noiseSeed: 1234,
    });
    expect(noisySecant.history.length).toBeGreaterThan(0);
  });

  it('benchmark runs and produces timing comparison', () => {
    const bench = benchmarkSolvers(mu, T, 850, 850, 900, 100);
    expect(bench.runs).toBe(100);
    expect(bench.newtonAvgMicroseconds).toBeGreaterThan(0);
    expect(bench.secantAvgMicroseconds).toBeGreaterThan(0);
  });
});
