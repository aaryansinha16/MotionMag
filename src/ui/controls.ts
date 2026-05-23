// Thin wrappers around the DOM elements the rest of the app talks to.
// Centralising lookups keeps `main.ts` free of `querySelector` boilerplate
// and means a renamed id changes one line, not five.

import { getAllCogs, type Cog } from '../cogs';

export interface UIRefs {
  startButton: HTMLButtonElement;
  canvas: HTMLCanvasElement;
  status: HTMLElement;
  cogSelect: HTMLSelectElement;
  perf: HTMLElement;
  alphaInput: HTMLInputElement;
  alphaValue: HTMLElement;
  roi: HTMLElement;
  bpm: HTMLElement;
  warning: HTMLElement;
  onboard: HTMLElement;
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
  const cogSelect = document.querySelector<HTMLSelectElement>('#cog');
  const warning = document.querySelector<HTMLElement>('#warning');
  const onboard = document.querySelector<HTMLElement>('#onboard');

  if (!startButton) throw new Error('UI: #start button not found');
  if (!canvas) throw new Error('UI: #output canvas not found');
  if (!status) throw new Error('UI: #status element not found');
  if (!perf) throw new Error('UI: #perf element not found');
  if (!alphaInput) throw new Error('UI: #alpha input not found');
  if (!alphaValue) throw new Error('UI: #alpha-value output not found');
  if (!roi) throw new Error('UI: #roi element not found');
  if (!bpm) throw new Error('UI: #bpm element not found');
  if (!cogSelect) throw new Error('UI: #cog select not found');
  if (!warning) throw new Error('UI: #warning element not found');
  if (!onboard) throw new Error('UI: #onboard element not found');

  populateCogSelect(cogSelect);

  return {
    startButton, canvas, status, cogSelect, perf,
    alphaInput, alphaValue, roi, bpm, warning, onboard,
  };
}

function populateCogSelect(select: HTMLSelectElement): void {
  select.replaceChildren();
  for (const cog of getAllCogs()) {
    const opt = document.createElement('option');
    opt.value = cog.id;
    opt.textContent = cog.displayName;
    opt.title = cog.description;
    select.appendChild(opt);
  }
}

export function setStatus(refs: UIRefs, message: string): void {
  refs.status.textContent = message;
}

export function setStartEnabled(refs: UIRefs, enabled: boolean): void {
  refs.startButton.disabled = !enabled;
}

export function getActiveCogId(refs: UIRefs): string {
  return refs.cogSelect.value;
}

export function onCogChange(refs: UIRefs, handler: (id: string) => void): void {
  refs.cogSelect.addEventListener('change', () => {
    handler(refs.cogSelect.value);
  });
}

export function getAlpha(refs: UIRefs): number {
  const v = Number.parseFloat(refs.alphaInput.value);
  return Number.isFinite(v) ? v : 0;
}

export function setAlpha(refs: UIRefs, alpha: number): void {
  refs.alphaInput.value = String(alpha);
  refs.alphaValue.textContent = `×${alpha.toFixed(0)}`;
}

export function onAlphaChange(refs: UIRefs, handler: (alpha: number) => void): void {
  refs.alphaInput.addEventListener('input', () => {
    const a = getAlpha(refs);
    refs.alphaValue.textContent = `×${a.toFixed(0)}`;
    handler(a);
  });
}

export function showROI(
  refs: UIRefs,
  bbox: { xNorm: number; yNorm: number; widthNorm: number; heightNorm: number },
): void {
  refs.roi.hidden = false;
  refs.roi.style.left = `${(bbox.xNorm * 100).toFixed(2)}%`;
  refs.roi.style.top = `${(bbox.yNorm * 100).toFixed(2)}%`;
  refs.roi.style.width = `${(bbox.widthNorm * 100).toFixed(2)}%`;
  refs.roi.style.height = `${(bbox.heightNorm * 100).toFixed(2)}%`;
}

export function hideROI(refs: UIRefs): void {
  refs.roi.hidden = true;
}

export function setBPM(refs: UIRefs, bpm: number | null, visible: boolean): void {
  refs.bpm.hidden = !visible;
  refs.bpm.textContent = bpm === null ? '— BPM' : `♥ ${Math.round(bpm)} BPM`;
}

export function statusForCog(cog: Cog): string {
  const settle = cog.slowSettle ? ' Filter transient takes ~30–60 s for this band.' : '';
  return `Active: ${cog.displayName} — ${cog.description}${settle}`;
}

export function setWarning(refs: UIRefs, message: string | null): void {
  if (message === null) {
    refs.warning.hidden = true;
    refs.warning.textContent = '';
  } else {
    refs.warning.hidden = false;
    refs.warning.textContent = message;
  }
}

const ONBOARD_SESSION_KEY = 'motionmag-onboarded';
const ONBOARD_AUTO_DISMISS_MS = 8000;

export function showOnboardingIfFirstTime(refs: UIRefs): void {
  // sessionStorage scopes to the current tab; reload or new tab shows again.
  // localStorage would persist across sessions, but we don't want
  // "tried it months ago, forgot how it works" users to miss the hints.
  let alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem(ONBOARD_SESSION_KEY) === '1';
  } catch {
    // Private-mode Safari can throw on sessionStorage access — just show.
  }
  if (alreadySeen) return;

  refs.onboard.hidden = false;
  const dismiss = (): void => {
    refs.onboard.hidden = true;
    refs.onboard.removeEventListener('click', dismiss);
    document.removeEventListener('keydown', onKey);
    window.clearTimeout(autoTimer);
    try {
      sessionStorage.setItem(ONBOARD_SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') dismiss();
  };
  refs.onboard.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey);
  const autoTimer = window.setTimeout(dismiss, ONBOARD_AUTO_DISMISS_MS);
}
