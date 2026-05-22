import { Camera, CameraError } from './pipeline/capture';
import { drawVideoFrame, initDisplay, DisplayError, type DisplayContext } from './pipeline/display';
import { getUIRefs, setStartEnabled, setStatus, type UIRefs } from './ui/controls';

const camera = new Camera();
let display: DisplayContext | null = null;

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
  } catch (err) {
    if (err instanceof DisplayError) {
      setStatus(refs, err.message);
    } else {
      console.error(err);
      setStatus(refs, 'Unexpected error initialising the display.');
    }
    setStartEnabled(refs, true);
    return;
  }

  setStatus(refs, 'Streaming. (Magnification arrives in M2.)');
  pumpFrames(camera.getVideoElement(), display);
}

// requestVideoFrameCallback fires once per decoded video frame (Chrome 83+,
// Safari 15.4+). For a passthrough rAF would also work, but rVFC gives us
// per-frame timing for free, which the pyramid + perf-overlay PRs will want.
type RVFCCallback = (now: DOMHighResTimeStamp, metadata: unknown) => void;
type RVFCCapable = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: RVFCCallback) => number;
};

function pumpFrames(video: HTMLVideoElement, ctx: DisplayContext): void {
  const rvfc = (video as RVFCCapable).requestVideoFrameCallback;
  if (typeof rvfc === 'function') {
    const tick: RVFCCallback = () => {
      drawVideoFrame(ctx, video);
      rvfc.call(video, tick);
    };
    rvfc.call(video, tick);
  } else {
    const tick = (): void => {
      drawVideoFrame(ctx, video);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function main(): void {
  const refs = getUIRefs();
  refs.startButton.addEventListener('click', () => {
    void handleStart(refs);
  });
  window.addEventListener('pagehide', () => camera.stop());
}

main();
