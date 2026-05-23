import type { Cog } from './types';

// The original ★★★★★ demo: amplify the 0.8–2.5 Hz band on the green channel
// at pyramid L2, then surface the scalar pulse rate as a BPM number.

export const pulseFinder: Cog = {
  id: 'pulse-finder',
  displayName: 'Pulse',
  description: 'See your heartbeat in your face. Sit still under good light for 10–15 s.',
  bandHz: [0.8, 2.5],
  amplification: 50,
  pyramidLevel: 2,
  roi: 'forehead',
  postprocess: 'pulse-bpm',
};
