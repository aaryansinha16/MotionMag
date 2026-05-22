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
  getSelectedLevel,
  getUIRefs,
  onLevelChange,
  setStartEnabled,
  setStatus,
  type UIRefs,
} from './ui/controls';

const camera = new Camera();
let display: DisplayContext | null = null;
let pyramid: PyramidContext | null = null;
let currentLevel = 0;

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
  } catch (err) {
    if (err instanceof DisplayError || err instanceof PyramidError) {
      setStatus(refs, err.message);
    } else {
      console.error(err);
      setStatus(refs, 'Unexpected error initialising the pipeline.');
    }
    setStartEnabled(refs, true);
    return;
  }

  setStatus(refs, 'Streaming. Switch L0–L3 to inspect each pyramid level.');
  pumpFrames(camera.getVideoElement(), display, pyramid);
}

// requestVideoFrameCallback fires once per decoded video frame (Chrome 83+,
// Safari 15.4+). For pyramid passes rAF would also work, but rVFC gives us
// per-frame timing for free, which the perf-overlay PR will want.
type RVFCCallback = (now: DOMHighResTimeStamp, metadata: unknown) => void;
type RVFCCapable = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: RVFCCallback) => number;
};

function pumpFrames(
  video: HTMLVideoElement,
  displayCtx: DisplayContext,
  pyramidCtx: PyramidContext,
): void {
  const step = (): void => {
    if (!uploadVideoFrame(displayCtx, video)) return;
    processPyramid(
      pyramidCtx,
      displayCtx.inputTexture,
      displayCtx.textureWidth,
      displayCtx.textureHeight,
    );
    const view = getLevelView(
      pyramidCtx,
      displayCtx.inputTexture,
      displayCtx.textureWidth,
      displayCtx.textureHeight,
      currentLevel,
    );
    drawTexture(displayCtx, view.texture);
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
  onLevelChange(refs, (level) => {
    currentLevel = level;
  });
  refs.startButton.addEventListener('click', () => {
    void handleStart(refs);
  });
  window.addEventListener('pagehide', () => camera.stop());
}

main();
