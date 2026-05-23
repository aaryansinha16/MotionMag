import type { Cog } from './types';

// Flag-wave: amplifies slow turbulent motion (curtains, flags, hair) in the
// 0.3–2 Hz band. Pyramid level 1 keeps enough spatial detail to read the
// edges of moving fabric without thrashing the budget.

export const flagWave: Cog = {
  id: 'flag-wave',
  displayName: 'Flag wave',
  description: 'Curtain or flag turbulence amplified. Point the camera at a still-ish piece of fabric.',
  bandHz: [0.3, 2],
  amplification: 40,
  pyramidLevel: 1,
  roi: 'full-frame',
};
