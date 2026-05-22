# MotionMag

> See your own pulse in your face. In your browser. With no app to install, no camera permission beyond webcam, and no pixels ever leaving your device.

**MotionMag** is a browser implementation of Eulerian Video Magnification. Point your webcam at yourself, and the page amplifies the invisible sub-percent color changes in your skin until your heartbeat becomes visible to your own eyes.

The pipeline runs entirely on your machine — WebGL2 shaders process the video frames in real time. Nothing is uploaded. There is no backend.

## Try it

> *(deployed URL goes here after Milestone 6)*

## How it works

Every heartbeat pulses blood through the capillaries in your face. Your skin reddens by about half a percent with each beat — far below what your eye can see. MotionMag isolates that 0.8–2.5 Hz temporal band in the video signal and multiplies it by 50–100×. The change becomes visible without becoming distorted.

The math is from the [MIT CSAIL 2012 paper](http://people.csail.mit.edu/mrub/papers/vidmag.pdf) by Wu et al. The packaging — browser-only, modular, ten different "magnify X" effects in one page — is new.

## The cog catalog

MotionMag ships as a catalog of small effects ("cogs"). Each one takes the same pipeline and tunes it for a different invisible signal:

| Cog | What it reveals |
|---|---|
| `pulse-finder` | Your heartbeat in your face, plus BPM |
| `breath-from-color` | Breathing-rate color shifts |
| `tremor-amp` | Hand tremor when you try to hold still |
| `micro-blush` | Emotion-driven blood-flow changes |
| `string-vibration` | Guitar/piano string oscillation |
| `glass-of-water` | Footsteps as ripples in a glass |
| `screen-flicker` | PWM dimming of LEDs |
| `infant-breathing` | Baby-monitor mode with apnea alert |
| `flag-wave` | Wind turbulence on a curtain |
| `micro-expression` | Slow + amplify face for tells |

## Privacy

- All processing runs in your browser via WebGL2.
- No video data leaves your device, ever.
- No analytics, no third-party scripts, no cookies.
- Open DevTools → Network. After page load, you should see zero requests.

## Run locally

```bash
git clone https://github.com/<you>/motionmag.git
cd motionmag
npm install
npm run dev
```

Open the local URL Vite prints. Click "Start." Allow webcam.

## Built on

- [Vite](https://vitejs.dev/) + TypeScript
- WebGL2 fragment shaders for the pyramid + temporal-filter pipeline
- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) (lazy-loaded, only for face-ROI cogs)

## License

MIT. See `LICENSE`.

## Project docs

- [`CLAUDE.md`](./CLAUDE.md) — instructions for Claude Code working in this repo
- [`DECISIONS.md`](./DECISIONS.md) — architecture decision log
- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — phased roadmap
- [`MEMORY.md`](./MEMORY.md) — running state and session log
- [`docs/five-star-projects.md`](./docs/five-star-projects.md) — the four "wait what?" project ideas this one was picked from
