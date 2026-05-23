// Thin wrappers around the DOM elements the rest of the app talks to.
// Centralising lookups keeps `main.ts` free of `querySelector` boilerplate
// and means a renamed id changes one line, not five.

import { PYRAMID_LEVEL_COUNT } from '../pipeline/pyramid';

export interface UIRefs {
  startButton: HTMLButtonElement;
  canvas: HTMLCanvasElement;
  status: HTMLElement;
  levelInputs: HTMLInputElement[];
  perf: HTMLElement;
  alphaInput: HTMLInputElement;
  alphaValue: HTMLElement;
  roi: HTMLElement;
  bpm: HTMLElement;
}

export function getUIRefs(): UIRefs {
  const startButton = document.querySelector<HTMLButtonElement>('#start');
  const canvas = document.querySelector<HTMLCanvasElement>('#output');
  const status = document.querySelector<HTMLElement>('#status');
  const perf = document.querySelector<HTMLElement>('#perf');
  const alphaInput = document.querySelector<HTMLInputElement>('#alpha');
  const alphaValue = document.querySelector<HTMLElement>('#alpha-value');
  const roi = document.querySelector<HTMLElement>('#roi');
  const bpm = document.querySelector<HTMLElement>('#bpm');
  const levelInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('#level-picker input[type="radio"]'),
  );

  if (!startButton) throw new Error('UI: #start button not found');
  if (!canvas) throw new Error('UI: #output canvas not found');
  if (!status) throw new Error('UI: #status element not found');
  if (!perf) throw new Error('UI: #perf element not found');
  if (!alphaInput) throw new Error('UI: #alpha input not found');
  if (!alphaValue) throw new Error('UI: #alpha-value output not found');
  if (!roi) throw new Error('UI: #roi element not found');
  if (!bpm) throw new Error('UI: #bpm element not found');
  if (levelInputs.length !== PYRAMID_LEVEL_COUNT) {
    throw new Error(
      `UI: expected ${PYRAMID_LEVEL_COUNT} level radios, got ${levelInputs.length}`,
    );
  }

  return { startButton, canvas, status, levelInputs, perf, alphaInput, alphaValue, roi, bpm };
}

export function setBPM(refs: UIRefs, bpm: number | null, visible: boolean): void {
  refs.bpm.hidden = !visible;
  refs.bpm.textContent = bpm === null ? '— BPM' : `♥ ${Math.round(bpm)} BPM`;
}

export function showROI(refs: UIRefs, bbox: { xNorm: number; yNorm: number; widthNorm: number; heightNorm: number }): void {
  refs.roi.hidden = false;
  refs.roi.style.left = `${(bbox.xNorm * 100).toFixed(2)}%`;
  refs.roi.style.top = `${(bbox.yNorm * 100).toFixed(2)}%`;
  refs.roi.style.width = `${(bbox.widthNorm * 100).toFixed(2)}%`;
  refs.roi.style.height = `${(bbox.heightNorm * 100).toFixed(2)}%`;
}

export function hideROI(refs: UIRefs): void {
  refs.roi.hidden = true;
}

export function setStatus(refs: UIRefs, message: string): void {
  refs.status.textContent = message;
}

export function setStartEnabled(refs: UIRefs, enabled: boolean): void {
  refs.startButton.disabled = !enabled;
}

export function getSelectedLevel(refs: UIRefs): number {
  for (const input of refs.levelInputs) {
    if (input.checked) {
      const value = Number.parseInt(input.value, 10);
      if (Number.isFinite(value)) return value;
    }
  }
  return 0;
}

export function onLevelChange(refs: UIRefs, handler: (level: number) => void): void {
  for (const input of refs.levelInputs) {
    input.addEventListener('change', () => {
      if (input.checked) handler(getSelectedLevel(refs));
    });
  }
}

export function getAlpha(refs: UIRefs): number {
  const v = Number.parseFloat(refs.alphaInput.value);
  return Number.isFinite(v) ? v : 0;
}

export function onAlphaChange(refs: UIRefs, handler: (alpha: number) => void): void {
  refs.alphaInput.addEventListener('input', () => {
    const a = getAlpha(refs);
    refs.alphaValue.textContent = `×${a.toFixed(0)}`;
    handler(a);
  });
}
