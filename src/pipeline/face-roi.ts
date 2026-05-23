// Face ROI: lazy-loads MediaPipe Face Landmarker on first activation, then
// runs per-frame detection and converts the landmark mesh into a forehead
// bounding box that the pulse-meter samples from.
//
// MediaPipe + the model are dynamically imported so Vite splits them into
// their own chunk. The initial bundle stays small (per CLAUDE.md "don't
// pull in a CV megaframework wholesale"); the face-detector chunk only
// loads when Start is clicked with a face-ROI cog active.
//
// Model + WASM are fetched from jsDelivr / Google's mediapipe-models CDN
// on first activation. This is a deliberate one-time fetch on user action,
// not a page-load request — the privacy story ("no pixels leave your
// device") still holds. Self-hosting the model is an M5 polish task.

import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// MediaPipe's canonical face mesh, https://developers.google.com/mediapipe/solutions/vision/face_landmarker
// Forehead landmark indices we treat as the bbox corners:
//   10  → top of forehead (well above eyebrows, near hairline)
//   9   → between the eyebrows (bottom of forehead)
//   67  → outer-left forehead edge
//   297 → outer-right forehead edge
const FOREHEAD_TOP = 10;
const FOREHEAD_BOTTOM = 9;
const FOREHEAD_LEFT = 67;
const FOREHEAD_RIGHT = 297;

// Inset the bbox to avoid eyebrow / hair edge pixels.
const FOREHEAD_INSET = 0.1;

const WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

export class FaceROIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FaceROIError';
  }
}

export interface ForeheadBBox {
  /** Top-left x in pixel coords (relative to source video). */
  readonly x: number;
  /** Top-left y in pixel coords. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Same rectangle expressed as 0..1 fractions of the video, for CSS overlays. */
  readonly xNorm: number;
  readonly yNorm: number;
  readonly widthNorm: number;
  readonly heightNorm: number;
}

export interface FaceROIContext {
  readonly landmarker: FaceLandmarker;
}

export async function initFaceROI(): Promise<FaceROIContext> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    return { landmarker };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new FaceROIError(`Could not initialise MediaPipe Face Landmarker: ${reason}`);
  }
}

// Detect a face and return the forehead bbox. Returns null when no face
// is detected (or when the landmarks we need are missing / off-screen).
export function detectForeheadBBox(
  ctx: FaceROIContext,
  video: HTMLVideoElement,
  timestampMs: number,
): ForeheadBBox | null {
  const result: FaceLandmarkerResult = ctx.landmarker.detectForVideo(video, timestampMs);
  const face = result.faceLandmarks[0];
  if (!face) return null;

  const top = face[FOREHEAD_TOP];
  const bottom = face[FOREHEAD_BOTTOM];
  const left = face[FOREHEAD_LEFT];
  const right = face[FOREHEAD_RIGHT];
  if (!top || !bottom || !left || !right) return null;

  // Raw bbox in normalised coords.
  let x1 = Math.min(left.x, right.x);
  let x2 = Math.max(left.x, right.x);
  let y1 = Math.min(top.y, bottom.y);
  let y2 = Math.max(top.y, bottom.y);

  // Inset 10% on each side to skip eyebrow / hairline pixels.
  const wn = x2 - x1;
  const hn = y2 - y1;
  if (wn <= 0 || hn <= 0) return null;
  x1 += wn * FOREHEAD_INSET;
  x2 -= wn * FOREHEAD_INSET;
  y1 += hn * FOREHEAD_INSET;
  y2 -= hn * FOREHEAD_INSET;

  // Clamp to [0, 1].
  x1 = Math.max(0, Math.min(1, x1));
  x2 = Math.max(0, Math.min(1, x2));
  y1 = Math.max(0, Math.min(1, y1));
  y2 = Math.max(0, Math.min(1, y2));

  const xNorm = x1;
  const yNorm = y1;
  const widthNorm = x2 - x1;
  const heightNorm = y2 - y1;
  if (widthNorm <= 0 || heightNorm <= 0) return null;

  const W = video.videoWidth;
  const H = video.videoHeight;
  return {
    x: Math.round(xNorm * W),
    y: Math.round(yNorm * H),
    width: Math.round(widthNorm * W),
    height: Math.round(heightNorm * H),
    xNorm,
    yNorm,
    widthNorm,
    heightNorm,
  };
}
