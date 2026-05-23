// Scalar pulse meter: samples the green channel inside the forehead ROI,
// streams it through a Butterworth biquad bandpass (the same cookbook
// coefficients as the per-pixel temporal shader), and estimates BPM by
// counting positive-going zero-crossings over a 10-second window.
//
// Per CLAUDE.md: filter math lives in `temporal.ts`; this module reuses
// `biquadBandpassCoeffs` and tracks the per-sample state in scalar form.

import type { ForeheadBBox } from './face-roi';
import { biquadBandpassCoeffs } from './temporal';

const SAMPLE_RATE_HZ = 30;
const WINDOW_SECONDS = 10;
const WINDOW_SAMPLES = SAMPLE_RATE_HZ * WINDOW_SECONDS;
// Don't report BPM until we have at least this much filter history;
// before then the readings are dominated by the bandpass transient.
const WARMUP_SAMPLES = SAMPLE_RATE_HZ * 5;
const BPM_MIN = 40;
const BPM_MAX = 200;
// Only promote a new estimate to `lastStableBPM` if it agrees with the
// previous reading within this tolerance. Suppresses single-frame jitter.
const BPM_STABILITY_TOLERANCE = 3;

export class PulseMeterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PulseMeterError';
  }
}

export interface PulseMeter {
  recordFrame(video: HTMLVideoElement, bbox: ForeheadBBox): void;
  getBPM(): number | null;
  reset(): void;
}

export function initPulseMeter(): PulseMeter {
  const coeffs = biquadBandpassCoeffs(0.8, 2.5, SAMPLE_RATE_HZ);

  // Streaming biquad state.
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  // Ring buffer of the last WINDOW_SAMPLES filtered values.
  const filtered: number[] = [];

  const sampleCanvas = document.createElement('canvas');
  const rawCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!rawCtx) throw new PulseMeterError('2D context unavailable for ROI sampling.');
  // Re-bind to a const so the narrowed-non-null type carries into nested closures.
  const sampleCtx: CanvasRenderingContext2D = rawCtx;
  let canvasWidth = 0;
  let canvasHeight = 0;

  let lastStableBPM: number | null = null;
  let prevReading: number | null = null;

  function stepBiquad(x0: number): number {
    const y0 =
      coeffs.b0 * x0 +
      coeffs.b1 * x1 +
      coeffs.b2 * x2 -
      coeffs.a1 * y1 -
      coeffs.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    return y0;
  }

  function meanGreen(video: HTMLVideoElement, bbox: ForeheadBBox): number {
    const w = bbox.width;
    const h = bbox.height;
    if (w === 0 || h === 0) return 0;
    if (w !== canvasWidth || h !== canvasHeight) {
      sampleCanvas.width = w;
      sampleCanvas.height = h;
      canvasWidth = w;
      canvasHeight = h;
    }
    sampleCtx.drawImage(video, bbox.x, bbox.y, w, h, 0, 0, w, h);
    const data = sampleCtx.getImageData(0, 0, w, h).data;
    let sum = 0;
    const pixelCount = data.length / 4;
    for (let i = 1; i < data.length; i += 4) {
      sum += data[i] ?? 0;
    }
    return sum / pixelCount / 255;
  }

  // BPM via positive-going zero-crossings.
  // Each heartbeat cycle has exactly one positive-going zero-crossing,
  // so BPM = (crossings × 60) / windowSeconds.
  function estimateBPM(): number | null {
    if (filtered.length < WARMUP_SAMPLES) return null;
    let crossings = 0;
    for (let i = 1; i < filtered.length; i++) {
      const prev = filtered[i - 1] ?? 0;
      const curr = filtered[i] ?? 0;
      if (prev < 0 && curr >= 0) crossings++;
    }
    const windowSeconds = filtered.length / SAMPLE_RATE_HZ;
    const bpm = (crossings * 60) / windowSeconds;
    if (bpm < BPM_MIN || bpm > BPM_MAX) return null;
    return bpm;
  }

  return {
    recordFrame(video, bbox) {
      const x0 = meanGreen(video, bbox);
      const y0 = stepBiquad(x0);
      filtered.push(y0);
      if (filtered.length > WINDOW_SAMPLES) filtered.shift();

      const reading = estimateBPM();
      if (
        reading !== null &&
        prevReading !== null &&
        Math.abs(reading - prevReading) <= BPM_STABILITY_TOLERANCE
      ) {
        lastStableBPM = reading;
      }
      prevReading = reading;
    },
    getBPM() {
      return lastStableBPM;
    },
    reset() {
      x1 = 0;
      x2 = 0;
      y1 = 0;
      y2 = 0;
      filtered.length = 0;
      lastStableBPM = null;
      prevReading = null;
    },
  };
}
