import { Camera, CameraError } from './pipeline/capture';
import {
  initDisplay,
  uploadVideoFrame,
  DisplayError,
  type DisplayContext,
} from './pipeline/display';
import {
  getLevelView,
  initPyramid,
  processPyramid,
  PyramidError,
  type PyramidContext,
} from './pipeline/pyramid';
import {
  initTemporal,
  processTemporal,
  setTemporalBand,
  TemporalError,
  type TemporalContext,
} from './pipeline/temporal';
import {
  drawAmplified,
  initAmplify,
  AmplifyError,
  type AmplifyContext,
} from './pipeline/amplify';
import {
  detectForeheadBBox,
  initFaceROI,
  FaceROIError,
  type FaceROIContext,
} from './pipeline/face-roi';
import { initPulseMeter, PulseMeterError, type PulseMeter } from './pipeline/pulse-meter';
import { getCogById, type Cog } from './cogs';
import {
  getActiveCogId,
  getUIRefs,
  hideROI,
  onAlphaChange,
  onCogChange,
  setAlpha,
  setBPM,
  setStartEnabled,
  setStatus,
  showROI,
  statusForCog,
  type UIRefs,
} from './ui/controls';
import { initPerfMeter, type PerfMeter } from './ui/perf-overlay';

const SAMPLE_RATE_HZ = 30;

const camera = new Camera();
let display: DisplayContext | null = null;
let pyramid: PyramidContext | null = null;
let temporal: TemporalContext | null = null;
let amplify: AmplifyContext | null = null;
let faceROI: FaceROIContext | null = null;
let faceROILoading: Promise<FaceROIContext> | null = null;
let pulseMeter: PulseMeter | null = null;
let currentCog: Cog;
let currentAlpha: number;

async function handleStart(refs: UIRefs): Promise<void> {
  setStartEnabled(refs, false);
  setStatus(refs, 'Requesting camera permission…');

  try {
    await camera.start();
  } catch (err) {
    if (err instanceof CameraError) {
      setStatus(refs, err.message);
    } else {
      console.error(err);
      setStatus(refs, 'Unexpected error starting the camera.');
    }
    setStartEnabled(refs, true);
    return;
  }

  try {
    display = initDisplay(refs.canvas);
    pyramid = initPyramid(display.gl);
    temporal = initTemporal(display.gl);
    amplify = initAmplify(display.gl);
    pulseMeter = initPulseMeter();
  } catch (err) {
    if (
      err instanceof DisplayError ||
      err instanceof PyramidError ||
      err instanceof TemporalError ||
      err instanceof AmplifyError ||
      err instanceof PulseMeterError
    ) {
      setStatus(refs, err.message);
    } else {
      console.error(err);
      setStatus(refs, 'Unexpected error initialising the pipeline.');
    }
    setStartEnabled(refs, true);
    return;
  }

  // Push the active cog's band into the temporal module — it was init'd with
  // a generic default that ignores cog choice.
  setTemporalBand(temporal, currentCog.bandHz[0], currentCog.bandHz[1], SAMPLE_RATE_HZ);

  const perf = initPerfMeter(refs.perf);

  setStatus(refs, statusForCog(currentCog));

  // Lazy-load MediaPipe only when the active cog actually needs an ROI.
  if (currentCog.roi === 'forehead') {
    ensureFaceROILoaded(refs);
  }

  pumpFrames(refs, camera.getVideoElement(), display, pyramid, temporal, amplify, pulseMeter, perf);
}

function ensureFaceROILoaded(refs: UIRefs): void {
  if (faceROI || faceROILoading) return;
  setStatus(refs, 'Loading face detector…');
  faceROILoading = initFaceROI()
    .then((ctx) => {
      faceROI = ctx;
      setStatus(refs, statusForCog(currentCog));
      return ctx;
    })
    .catch((err: unknown) => {
      const message =
        err instanceof FaceROIError
          ? err.message
          : `Could not load face detector: ${err instanceof Error ? err.message : String(err)}`;
      setStatus(refs, message);
      throw err;
    });
}

function applyActiveCog(refs: UIRefs, cog: Cog): void {
  currentCog = cog;
  currentAlpha = cog.amplification;
  setAlpha(refs, currentAlpha);
  setStatus(refs, statusForCog(cog));

  if (temporal) {
    setTemporalBand(temporal, cog.bandHz[0], cog.bandHz[1], SAMPLE_RATE_HZ);
  }
  if (pulseMeter) {
    pulseMeter.reset();
  }
  if (cog.roi === 'forehead') {
    ensureFaceROILoaded(refs);
  } else {
    hideROI(refs);
    setBPM(refs, null, false);
  }
}

// requestVideoFrameCallback fires once per decoded video frame (Chrome 83+,
// Safari 15.4+). For the active cog's pipeline rAF would also work, but
// rVFC gives us per-frame timing for free, which the perf overlay uses.
type RVFCCallback = (now: DOMHighResTimeStamp, metadata: unknown) => void;
type RVFCCapable = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: RVFCCallback) => number;
};

function pumpFrames(
  refs: UIRefs,
  video: HTMLVideoElement,
  displayCtx: DisplayContext,
  pyramidCtx: PyramidContext,
  temporalCtx: TemporalContext,
  amplifyCtx: AmplifyContext,
  pulseMeterCtx: PulseMeter,
  perf: PerfMeter,
): void {
  const { gl } = displayCtx;

  const step = (): void => {
    const t0 = performance.now();
    if (!uploadVideoFrame(displayCtx, video)) return;

    processPyramid(
      pyramidCtx,
      displayCtx.inputTexture,
      displayCtx.textureWidth,
      displayCtx.textureHeight,
    );

    const filterInput = getLevelView(
      pyramidCtx,
      displayCtx.inputTexture,
      displayCtx.textureWidth,
      displayCtx.textureHeight,
      currentCog.pyramidLevel,
    );
    const filteredState = processTemporal(
      temporalCtx,
      filterInput.texture,
      filterInput.width,
      filterInput.height,
    );

    // Magnification is always full-frame: the cog's pyramidLevel chooses
    // *which spatial frequencies to amplify*, not which pixels are touched.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, displayCtx.canvas.width, displayCtx.canvas.height);
    drawAmplified(amplifyCtx, displayCtx.inputTexture, filteredState, currentAlpha);

    // Per-cog overlays.
    if (currentCog.roi === 'forehead' && faceROI) {
      const bbox = detectForeheadBBox(faceROI, video, t0);
      if (bbox) {
        showROI(refs, bbox);
        if (currentCog.postprocess === 'pulse-bpm') {
          pulseMeterCtx.recordFrame(video, bbox);
          setBPM(refs, pulseMeterCtx.getBPM(), true);
        }
      } else {
        hideROI(refs);
        if (currentCog.postprocess === 'pulse-bpm') {
          setBPM(refs, null, true);
        }
      }
    } else {
      hideROI(refs);
      setBPM(refs, null, false);
    }

    // gl.finish() forces the GPU to complete all queued work before returning,
    // so the timer captures real pipeline cost rather than just CPU dispatch.
    gl.finish();
    perf.recordFrame(performance.now() - t0);
  };

  const rvfc = (video as RVFCCapable).requestVideoFrameCallback;
  if (typeof rvfc === 'function') {
    const tick: RVFCCallback = () => {
      step();
      rvfc.call(video, tick);
    };
    rvfc.call(video, tick);
  } else {
    const tick = (): void => {
      step();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function main(): void {
  const refs = getUIRefs();
  const activeId = getActiveCogId(refs);
  const initial = getCogById(activeId);
  if (!initial) {
    throw new Error(`Cog registry has no entry for default id "${activeId}".`);
  }
  currentCog = initial;
  currentAlpha = initial.amplification;
  setAlpha(refs, currentAlpha);

  onCogChange(refs, (id) => {
    const next = getCogById(id);
    if (next) applyActiveCog(refs, next);
  });
  onAlphaChange(refs, (alpha) => {
    currentAlpha = alpha;
  });

  refs.startButton.addEventListener('click', () => {
    void handleStart(refs);
  });
  window.addEventListener('pagehide', () => camera.stop());
}

main();
