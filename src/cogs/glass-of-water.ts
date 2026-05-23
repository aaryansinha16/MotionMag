import type { Cog } from './types';

// Glass-of-water: amplifies surface vibrations from foot-step or speaker
// energy in the 1–10 Hz band. Pyramid level 0 (full resolution) keeps the
// thin meniscus visible — a coarser level loses the signal entirely.

export const glassOfWater: Cog = {
  id: 'glass-of-water',
  displayName: 'Glass of water',
  description: 'Reveal sub-millimetre surface vibrations. Frame a glass on a table and walk past.',
  bandHz: [1, 10],
  amplification: 20,
  pyramidLevel: 0,
  roi: 'full-frame',
};
