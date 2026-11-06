/**
 * M/M/1 Queue Latency and DoS Threshold Model
 */

export interface MM1Params {
  mu: number; // Service rate (capacity in req/s)
  T: number;  // Timeout threshold in seconds
  lambdaLegitimo: number; // Legitimate arrival rate in req/s
}

/**
 * Expected response time in an M/M/1 queue: W(λ) = 1 / (μ - λ)
 * Defined strictly for λ < μ.
 */
export const getLatency = (lambda: number, mu: number): number => {
  if (lambda >= mu) return Infinity;
  if (lambda < 0) return 0;
  return 1 / (mu - lambda);
};

/**
 * Objective function for root finding:
 * f(λ) = W(λ) - T = 1 / (μ - λ) - T
 * A root f(λ*) = 0 means response time equals the timeout threshold T.
 */
export const objectiveFunction = (lambda: number, mu: number, T: number): number => {
  return getLatency(lambda, mu) - T;
};

/**
 * Analytical derivative of f(λ) with respect to λ:
 * f'(λ) = d/dλ [ (μ - λ)^(-1) - T ] = 1 / (μ - λ)^2
 * Notice f'(λ) > 0 for all λ < μ (monotonically increasing).
 */
export const objectiveDerivative = (lambda: number, mu: number): number => {
  if (lambda >= mu) return Infinity;
  return 1 / Math.pow(mu - lambda, 2);
};

/**
 * Closed-form analytical root:
 * 1 / (μ - λ) = T  =>  μ - λ = 1 / T  =>  λ* = μ - 1 / T
 * Used as the ground-truth benchmark for true error calculation.
 */
export const getAnalyticalRoot = (mu: number, T: number): number => {
  if (T <= 0) return mu;
  return mu - (1 / T);
};

/**
 * Calculates required attack rate to trigger timeout:
 * λ_ataque = max(0, λ* - λ_legítimo)
 */
export const getAttackThreshold = (analyticalOrSolvedRoot: number, lambdaLegitimo: number): {
  attackRate: number;
  serverOverloadedByLegit: boolean;
  saturationRatio: number;
} => {
  const attackRate = Math.max(0, analyticalOrSolvedRoot - lambdaLegitimo);
  const serverOverloadedByLegit = lambdaLegitimo >= analyticalOrSolvedRoot;
  const saturationRatio = analyticalOrSolvedRoot > 0 ? (lambdaLegitimo / analyticalOrSolvedRoot) * 100 : 100;
  return {
    attackRate,
    serverOverloadedByLegit,
    saturationRatio: Math.min(100, Math.max(0, saturationRatio)),
  };
};
