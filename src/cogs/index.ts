// Cog registry. Per D-006, each cog is a file in this directory exporting
// a `Cog` object; the registry lists them by name. Auto-discovery via
// `import.meta.glob` is the upgrade path once the catalog passes ~15.

import type { Cog } from './types';
import { breathFromColor } from './breath-from-color';
import { pulseFinder } from './pulse-finder';
import { tremorAmp } from './tremor-amp';

const cogs: readonly Cog[] = [pulseFinder, breathFromColor, tremorAmp];

export function getAllCogs(): readonly Cog[] {
  return cogs;
}

export function getCogById(id: string): Cog | undefined {
  return cogs.find((c) => c.id === id);
}

export { type Cog, type CogPostprocess, type CogROI } from './types';
