import type { Cog } from './types';

// Micro-expression (lite): face ROI on the 0.5–5 Hz band — fast involuntary
// movements that flicker too briefly for casual observation. The original
// design called for a temporal slow-down pass alongside amplification;
// that's deferred until the pipeline grows a slow-mo capability.

export const microExpression: Cog = {
  id: 'micro-expression',
  displayName: 'Micro-expression',
  description: 'Amplify quick involuntary facial movements. Temporal slow-mo planned for v1.1.',
  bandHz: [0.5, 5],
  amplification: 30,
  pyramidLevel: 2,
  roi: 'forehead',
};
