// A cog is a small config object that fully parameterises the shared
// pipeline (capture → pyramid → temporal → amplify → display) for a
// specific magnification effect. Adding an effect = adding a new cog file
// and one line in the registry — no pipeline code changes.
//
// **Divergence from CLAUDE.md's sketch:** that sketch has
//   `postprocess?: (signal: Float32Array) => { bpm?: number; label?: string }`
// — a closure on the cog object. A closure would have to reach into
// `pulse-meter.ts`'s scalar bandpass state to do anything useful, which
// is unnecessary coupling for the single postprocess type that exists
// today. We use a string discriminator (`'pulse-bpm'`) instead and let
// `main.ts` dispatch. Promote to a closure if a second postprocess kind
// ever lands.

export type CogROI = 'forehead' | 'full-frame';
export type CogPostprocess = 'pulse-bpm';

export interface Cog {
  /** Unique kebab-case identifier used in the dropdown value + the URL hash later. */
  readonly id: string;
  /** Short label shown in the dropdown ("Pulse"). */
  readonly displayName: string;
  /** One-line subtitle shown in the status area when this cog activates. */
  readonly description: string;
  /** Temporal bandpass range, in Hz. */
  readonly bandHz: readonly [number, number];
  /** Default amplification factor (the α slider starts here on cog switch). */
  readonly amplification: number;
  /**
   * Which Gaussian-pyramid level the biquad runs at.
   * 0 = full-resolution input, 3 = 80×60 at 640×480 capture (per D-008).
   */
  readonly pyramidLevel: number;
  /**
   * Where the cog's scalar postprocess samples from. `'full-frame'` skips
   * the MediaPipe lazy-load entirely (per D-007). Omit for the default of
   * `'full-frame'`.
   */
  readonly roi?: CogROI;
  /** Optional scalar postprocess that produces a label (e.g. BPM). */
  readonly postprocess?: CogPostprocess;
  /**
   * When true, a "filter transient takes ~30–60 s" warning shows in the
   * status text. Set on slow cogs (low Hz bandpass).
   */
  readonly slowSettle?: boolean;
}
