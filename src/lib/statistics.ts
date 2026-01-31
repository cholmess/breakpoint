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

/** z for 95% two-sided CI (approx 1.96) */
const Z_95 = 1.959963984540054;

/**
 * Wilson score 95% CI for binomial p = k/n.
 * Deterministic; width clearly varies with k and n (narrow when n large or p near 0/1).
 * Edge cases: n<=0 → [0,0]; k clamped to [0,n].
 */
export function wilsonScoreCI(
  k: number,
  n: number,
  _alpha = 0.05
): [number, number] {
  if (n <= 0) return [0, 0];
  const kClamped = Math.max(0, Math.min(k, n));
  const p = kClamped / n;
  const z = Z_95;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);
  return [lower, upper];
}

/**
 * Bootstrap 95% CI for binomial p = k/n.
 * Resample n trials with replacement, count "failures" proportion, repeat.
 * Edge cases: n<=0 → [0,0]; k clamped to [0,n] so proportion is valid.
 */
export function bootstrapCI(
  k: number,
  n: number,
  alpha = 0.05
): [number, number] {
  if (n <= 0) return [0, 0];
  const kClamped = Math.max(0, Math.min(k, n));
  const p = kClamped / n;
  const lowerIdx = Math.floor((alpha / 2) * BOOTSTRAP_ITERATIONS);
  const upperIdx = Math.floor((1 - alpha / 2) * BOOTSTRAP_ITERATIONS);
  const phats: number[] = [];
  for (let i = 0; i < BOOTSTRAP_ITERATIONS; i++) {
    let failures = 0;
    for (let j = 0; j < n; j++) {
      if (randomFn() < p) failures++;
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
 * Edge cases: n<=0 → [0,0]; k clamped to [0,n] so Beta(1+n-k) has beta>=1.
 */
export function bayesianBetaCI(
  k: number,
  n: number,
  alpha = 0.05
): [number, number] {
  if (n <= 0) return [0, 0];
  const kClamped = Math.max(0, Math.min(k, n));
  const a = 1 + kClamped;
  const b = 1 + n - kClamped;
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
 * Edge case: if either config has n<=0 (no data), return 0.5 (indeterminate).
 */
export function compareConfigs(a: Stats, b: Stats): { pASafer: number } {
  if (a.n <= 0 || b.n <= 0) return { pASafer: 0.5 };
  const aK = Math.max(0, Math.min(a.k, a.n));
  const bK = Math.max(0, Math.min(b.k, b.n));
  const aAlpha = 1 + aK;
  const aBeta = 1 + a.n - aK;
  const bAlpha = 1 + bK;
  const bBeta = 1 + b.n - bK;
  let countASafer = 0;
  for (let i = 0; i < COMPARE_SAMPLES; i++) {
    const pA = sampleBeta(aAlpha, aBeta);
    const pB = sampleBeta(bAlpha, bBeta);
    if (pA < pB) countASafer++;
  }
  return { pASafer: countASafer / COMPARE_SAMPLES };
}
