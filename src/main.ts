import { Camera, CameraError } from './pipeline/capture';
import { getUIRefs, setStartEnabled, setStatus, type UIRefs } from './ui/controls';

const camera = new Camera();

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

  setStatus(refs, 'Streaming. (Magnification arrives in M1+.)');
  pumpFramesToCanvas(camera.getVideoElement(), refs.canvas);
}

// requestVideoFrameCallback fires once per decoded video frame (Chrome 83+,
// Safari 15.4+). For a raw passthrough rAF would also work, but rVFC gives
// us per-frame timing for free, which the pyramid pipeline will want later.
type RVFCCallback = (now: DOMHighResTimeStamp, metadata: unknown) => void;
type RVFCCapable = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: RVFCCallback) => number;
};

function pumpFramesToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas context unavailable.');

  const drawIfReady = (): void => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.drawImage(video, 0, 0, w, h);
  };

  const rvfc = (video as RVFCCapable).requestVideoFrameCallback;
  if (typeof rvfc === 'function') {
    const tick: RVFCCallback = () => {
      drawIfReady();
      rvfc.call(video, tick);
    };
    rvfc.call(video, tick);
  } else {
    const tick = (): void => {
      drawIfReady();
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
