import type { Cog } from './types';

// Micro-blush: amplifies slow face-color shifts in the 0.2–1.0 Hz band —
// blood-flow changes driven by emotion (talking, blushing, embarrassment)
// rather than each heartbeat. Sits just below the pulse band so the two
// cogs don't overlap in what they reveal.

export const microBlush: Cog = {
  id: 'micro-blush',
  displayName: 'Blush',
  description: 'Slow emotion-driven blood-flow shifts on the face. Try talking or holding your breath.',
  bandHz: [0.2, 1.0],
  amplification: 80,
  pyramidLevel: 2,
  roi: 'forehead',
  slowSettle: true,
};
