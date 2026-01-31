/**
 * Person B: Statistics layer
 * bootstrapCI, bayesianBetaCI, compareConfigs
 */

import type { Stats } from "../types";

const BOOTSTRAP_ITERATIONS = 1000;
const BAYESIAN_SAMPLES = 10000;
const COMPARE_SAMPLES = 10000;

/**
 * RNG: default Math.random; tests can override via setStatsSeed for determinism.
 */
let seed = 12345;
function seededRandom(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
let randomFn: () => number = () => Math.random();

/**
 * Set seed for deterministic behavior (for tests). After this, randomFn uses LCG.
 */
export function setStatsSeed(s: number): void {
  seed = s;
  randomFn = seededRandom;
}

/**
 * Bootstrap 95% CI for binomial p = k/n.
 * Resample n trials with replacement, count "failures" proportion, repeat.
 */
export function bootstrapCI(
  k: number,
  n: number,
  alpha = 0.05
): [number, number] {
  if (n <= 0) return [0, 0];
  const lowerIdx = Math.floor((alpha / 2) * BOOTSTRAP_ITERATIONS);
  const upperIdx = Math.floor((1 - alpha / 2) * BOOTSTRAP_ITERATIONS);
  const phats: number[] = [];
  for (let i = 0; i < BOOTSTRAP_ITERATIONS; i++) {
    let failures = 0;
    for (let j = 0; j < n; j++) {
      if (randomFn() < k / n) failures++;
    }
    phats.push(failures / n);
  }
  phats.sort((a, b) => a - b);
  return [phats[lowerIdx] ?? 0, phats[upperIdx] ?? 1];
}

/**
 * Sample from Gamma(shape, 1) for integer shape (sum of shape exponentials).
 */
function sampleGammaInteger(shape: number): number {
  let sum = 0;
  for (let i = 0; i < shape; i++) {
    const u = randomFn();
    sum -= Math.log(u <= 0 ? 1e-10 : u);
  }
  return sum;
}

/**
 * Sample from Beta(alpha, beta) for alpha, beta >= 1 (integer).
 * Beta(a,b) = Gamma(a)/(Gamma(a)+Gamma(b)).
 */
function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGammaInteger(Math.floor(alpha));
  const y = sampleGammaInteger(Math.floor(beta));
  const t = x + y;
  return t <= 0 ? 0.5 : x / t;
}

/**
 * Bayesian 95% credible interval using Beta(1+k, 1+n-k) posterior (Beta(1,1) prior).
 */
export function bayesianBetaCI(
  k: number,
  n: number,
  alpha = 0.05
): [number, number] {
  if (n <= 0) return [0, 0];
  const a = 1 + k;
  const b = 1 + n - k;
  const samples: number[] = [];
  for (let i = 0; i < BAYESIAN_SAMPLES; i++) {
    samples.push(sampleBeta(a, b));
  }
  samples.sort((x, y) => x - y);
  const lowerIdx = Math.floor((alpha / 2) * BAYESIAN_SAMPLES);
  const upperIdx = Math.floor((1 - alpha / 2) * BAYESIAN_SAMPLES);
  return [samples[lowerIdx] ?? 0, samples[upperIdx] ?? 1];
}

/**
 * P(A safer than B) = P(p_A < p_B) using posterior samples.
 * A is safer when its failure rate is lower.
 */
export function compareConfigs(a: Stats, b: Stats): { pASafer: number } {
  const aAlpha = 1 + a.k;
  const aBeta = 1 + a.n - a.k;
  const bAlpha = 1 + b.k;
  const bBeta = 1 + b.n - b.k;
  let countASafer = 0;
  for (let i = 0; i < COMPARE_SAMPLES; i++) {
    const pA = sampleBeta(aAlpha, aBeta);
    const pB = sampleBeta(bAlpha, bBeta);
    if (pA < pB) countASafer++;
  }
  return { pASafer: countASafer / COMPARE_SAMPLES };
}
