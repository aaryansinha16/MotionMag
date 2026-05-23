import type { Cog } from './types';

// Infant-breathing (lite): face ROI on the 0.2–0.8 Hz band — typical infant
// breath rate. Audible apnea alert is intentionally deferred; that's its
// own pipeline capability (Web Audio + threshold + duration) worth a
// separate decision entry rather than bolted onto the cog interface.

export const infantBreathing: Cog = {
  id: 'infant-breathing',
  displayName: 'Infant breathing',
  description: 'Slow breath-rate visualisation on the face. Audible apnea alert is planned for v1.1.',
  bandHz: [0.2, 0.8],
  amplification: 80,
  pyramidLevel: 2,
  roi: 'forehead',
  slowSettle: true,
};
