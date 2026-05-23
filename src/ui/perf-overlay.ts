// Lightweight FPS + per-frame-ms readout. DOM-only — drawing it into the
// GL canvas would mean the overlay's own draw cost shows up in the metric.
//
// FPS is measured by counting frames that occurred within a rolling
// 1-second window, which auto-smooths and matches the way most browsers'
// own perf tools quote frame rate. `ms` is the rolling mean of the
// processing time main.ts hands us per frame.

const FPS_WINDOW_MS = 1000;
const MS_BUFFER_SIZE = 30;
const DOM_THROTTLE_MS = 250;

export interface PerfMeter {
  recordFrame(processMs: number): void;
}

export function initPerfMeter(target: HTMLElement): PerfMeter {
  const frameStamps: number[] = [];
  const processMsHistory: number[] = [];
  let lastUpdate = 0;

  return {
    recordFrame(processMs: number): void {
      const now = performance.now();
      frameStamps.push(now);

      const cutoff = now - FPS_WINDOW_MS;
      let drop = 0;
      while (drop < frameStamps.length && (frameStamps[drop] ?? 0) < cutoff) drop++;
      if (drop > 0) frameStamps.splice(0, drop);

      processMsHistory.push(processMs);
      if (processMsHistory.length > MS_BUFFER_SIZE) processMsHistory.shift();

      if (now - lastUpdate < DOM_THROTTLE_MS) return;
      lastUpdate = now;

      const fps = frameStamps.length;
      const sum = processMsHistory.reduce((acc, x) => acc + x, 0);
      const meanMs = processMsHistory.length > 0 ? sum / processMsHistory.length : 0;
      target.textContent = `${fps} fps · ${meanMs.toFixed(1)} ms`;
    },
  };
}
