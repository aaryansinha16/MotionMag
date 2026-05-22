// Webcam capture: a small wrapper around getUserMedia that hides the
// `<video>` element plumbing from the rest of the pipeline.
//
// Constraints follow D-009: 640×480 @ 30fps, front-facing, audio off.
// At higher resolutions the magnification math gets quadratically more
// expensive without buying any extra pulse signal, so we ask the browser
// to downscale on capture.

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user',
  },
  audio: false,
};

export type CameraFailureReason =
  | 'denied'
  | 'unavailable'
  | 'unsupported'
  | 'unknown';

export class CameraError extends Error {
  readonly reason: CameraFailureReason;

  constructor(reason: CameraFailureReason, message: string) {
    super(message);
    this.name = 'CameraError';
    this.reason = reason;
  }
}

export class Camera {
  private stream: MediaStream | null = null;
  private readonly video: HTMLVideoElement;
  private readonly constraints: MediaStreamConstraints;

  constructor(constraints: MediaStreamConstraints = DEFAULT_CONSTRAINTS) {
    this.constraints = constraints;
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
  }

  async start(): Promise<MediaStream> {
    if (this.stream) return this.stream;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError(
        'unsupported',
        'This browser does not support webcam capture (navigator.mediaDevices.getUserMedia missing).',
      );
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(this.constraints);
    } catch (err) {
      const reason = classifyError(err);
      throw new CameraError(reason, messageFor(reason));
    }

    this.stream = stream;
    this.video.srcObject = stream;

    // Autoplay should succeed because start() is invoked from a user gesture
    // (the Start button click). We still swallow the play() rejection because
    // some browsers surface a no-op AbortError when srcObject is reassigned.
    try {
      await this.video.play();
    } catch {
      /* non-fatal */
    }

    return stream;
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  isRunning(): boolean {
    return this.stream !== null;
  }
}

function classifyError(err: unknown): CameraFailureReason {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: unknown }).name);
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'unavailable';
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'unavailable';
  }
  return 'unknown';
}

function messageFor(reason: CameraFailureReason): string {
  switch (reason) {
    case 'denied':
      return 'Camera permission was denied. Allow access in your browser and reload the page.';
    case 'unavailable':
      return 'No camera available, or the camera is in use by another application.';
    case 'unsupported':
      return 'This browser does not support webcam capture.';
    case 'unknown':
      return 'Could not start the camera.';
  }
}
