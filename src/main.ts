import { Camera, CameraError } from './pipeline/capture';
import {
  drawTexture,
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
  getAlpha,
  getSelectedLevel,
  getUIRefs,
  onAlphaChange,
  onLevelChange,
  setStartEnabled,
  setStatus,
  type UIRefs,
} from './ui/controls';
import { initPerfMeter, type PerfMeter } from './ui/perf-overlay';

// Pyramid level at which we apply the temporal bandpass. Per D-008, level 2
// (160×120 at 640×480 capture) is where the pulse signal sits — low enough
// to suppress sensor noise, high enough to localise to skin regions.
const TEMPORAL_LEVEL = 2;

const camera = new Camera();
let display: DisplayContext | null = null;
let pyramid: PyramidContext | null = null;
let temporal: TemporalContext | null = null;
let amplify: AmplifyContext | null = null;
let currentLevel = 0;
let currentAlpha = 50;

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
  } catch (err) {
    if (
      err instanceof DisplayError ||
      err instanceof PyramidError ||
      err instanceof TemporalError ||
      err instanceof AmplifyError
    ) {
      setStatus(refs, err.message);
    } else {
      console.error(err);
      setStatus(refs, 'Unexpected error initialising the pipeline.');
    }
    setStartEnabled(refs, true);
    return;
  }

  const perf = initPerfMeter(refs.perf);

  setStatus(
    refs,
    'Streaming. Sit still and watch — pulse becomes visible in 5–15 s as the filter settles.',
  );
  pumpFrames(camera.getVideoElement(), display, pyramid, temporal, amplify, perf);
}

// requestVideoFrameCallback fires once per decoded video frame (Chrome 83+,
// Safari 15.4+). For the M2 pipeline rAF would also work, but rVFC gives us
// per-frame timing for free, which the perf overlay uses.
type RVFCCallback = (now: DOMHighResTimeStamp, metadata: unknown) => void;
type RVFCCapable = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: RVFCCallback) => number;
};

function pumpFrames(
  video: HTMLVideoElement,
  displayCtx: DisplayContext,
  pyramidCtx: PyramidContext,
  temporalCtx: TemporalContext,
  amplifyCtx: AmplifyContext,
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
      TEMPORAL_LEVEL,
    );
    const filteredState = processTemporal(
      temporalCtx,
      filterInput.texture,
      filterInput.width,
      filterInput.height,
    );

    if (currentLevel === 0) {
      // Pulse view: original + α·filteredBand, full-res output.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, displayCtx.canvas.width, displayCtx.canvas.height);
      drawAmplified(amplifyCtx, displayCtx.inputTexture, filteredState, currentAlpha);
    } else {
      // Debug view: just render the requested pyramid level.
      const view = getLevelView(
        pyramidCtx,
        displayCtx.inputTexture,
        displayCtx.textureWidth,
        displayCtx.textureHeight,
        currentLevel,
      );
      drawTexture(displayCtx, view.texture);
    }

    // gl.finish() forces the GPU to complete all queued work before returning,
    // so the timer captures real pipeline cost rather than just CPU dispatch.
    // Adds a sync stall but it's the only way to verify the 16 ms budget
    // without EXT_disjoint_timer_query_webgl2.
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
  currentLevel = getSelectedLevel(refs);
  currentAlpha = getAlpha(refs);
  refs.alphaValue.textContent = `×${currentAlpha.toFixed(0)}`;
  onLevelChange(refs, (level) => {
    currentLevel = level;
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
