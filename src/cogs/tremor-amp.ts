import type { Cog } from './types';

// Tremor-amp: high-band (4–12 Hz), full-frame magnification at pyramid
// level 1 (320×240). Point the camera at a hand "held still" and the
// micro-tremor every body has becomes visible. Short filter transient
// (high-frequency poles settle in <1 s), so it's usable right away.

export const tremorAmp: Cog = {
  id: 'tremor-amp',
  displayName: 'Tremor',
  description: 'Amplifies tiny 4–12 Hz motion. Try holding a hand or object still.',
  bandHz: [4, 12],
  amplification: 30,
  pyramidLevel: 1,
  roi: 'full-frame',
};
