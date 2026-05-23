import type { Cog } from './types';

// Breath-from-color: same pipeline, very-low-band (0.1–0.5 Hz). Breathing
// produces subtle skin-tone shifts as oxygenation changes; amplifying that
// band reveals it. Slow filter — the user needs to set expectations,
// hence `slowSettle: true`.
//
// Pyramid level 2 mirrors the pulse cog; the breath signal is similarly
// low-spatial-frequency (whole-face shift), so the same level works.

export const breathFromColor: Cog = {
  id: 'breath-from-color',
  displayName: 'Breath',
  description: 'Breath-rate color shifts on the face. Takes longer to surface than pulse.',
  bandHz: [0.1, 0.5],
  amplification: 100,
  pyramidLevel: 2,
  roi: 'full-frame',
  slowSettle: true,
};
