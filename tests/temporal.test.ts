import { describe, expect, it } from 'vitest';
import { applyBiquad, biquadBandpassCoeffs } from '../src/pipeline/temporal';

const fs = 30;
const fLow = 0.8;
const fHigh = 2.5;
const coeffs = biquadBandpassCoeffs(fLow, fHigh, fs);

function sinusoid(freqHz: number, N: number): number[] {
  return Array.from({ length: N }, (_, i) =>
    Math.sin((2 * Math.PI * freqHz * i) / fs),
  );
}

function rms(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sumSq = xs.reduce((s, x) => s + x * x, 0);
  return Math.sqrt(sumSq / xs.length);
}

// Skip the first 500 samples to let the filter's group-delay transient die out.
function steadyStateRMS(freqHz: number, N = 2000): number {
  return rms(applyBiquad(coeffs, sinusoid(freqHz, N)).slice(500));
}

describe('biquadBandpassCoeffs', () => {
  it('matches RBJ cookbook structure: b0 = -b2, b1 = 0', () => {
    expect(coeffs.b1).toBe(0);
    expect(coeffs.b0).toBeCloseTo(-coeffs.b2, 12);
  });

  it('produces a stable filter (|a2| < 1)', () => {
    expect(Math.abs(coeffs.a2)).toBeLessThan(1);
  });

  it('rejects an invalid band', () => {
    expect(() => biquadBandpassCoeffs(2.5, 0.8, 30)).toThrow();
    expect(() => biquadBandpassCoeffs(0.8, 2.5, 0)).toThrow();
  });
});

describe('biquad bandpass frequency response', () => {
  it('passes the geometric centre frequency near unity gain', () => {
    const f0 = Math.sqrt(fLow * fHigh);
    // A unit sinusoid has RMS = 1/√2 ≈ 0.707; bandpass at f₀ has gain 1 by design.
    expect(steadyStateRMS(f0)).toBeGreaterThan(0.6);
  });

  it('attenuates frequencies well above the passband', () => {
    expect(steadyStateRMS(10)).toBeLessThan(0.1);
  });

  it('passband / stopband ratio is at least 8×', () => {
    // A single biquad bandpass rolls off at ~6 dB/octave. From the geometric
    // centre (~1.41 Hz) to 10 Hz is ~2.83 octaves → ~17 dB ≈ 7× theoretical.
    // 8× catches order-of-magnitude regressions while leaving honest headroom.
    const f0 = Math.sqrt(fLow * fHigh);
    expect(steadyStateRMS(f0) / steadyStateRMS(10)).toBeGreaterThan(8);
  });

  it('blocks DC: constant input decays to zero', () => {
    const N = 2000;
    const output = applyBiquad(coeffs, new Array<number>(N).fill(1.0));
    const last = output[N - 1] ?? 0;
    expect(Math.abs(last)).toBeLessThan(0.01);
  });
});
