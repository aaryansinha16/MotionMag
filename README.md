# MotionMag

> See your own pulse in your face. In your browser. With no app to install, no camera permission beyond webcam, and no pixels ever leaving your device.

**MotionMag** is a browser implementation of Eulerian Video Magnification. Point your webcam at yourself, click Start, wait ten seconds — your heartbeat becomes visible in your skin. Or switch cogs to amplify the flutter of a curtain, the ripple in a glass of water, or the slow color shift as you breathe.

<!-- TODO: replace with hero.gif once recorded. See issue #41. -->
<!-- ![hero](public/demos/pulse-finder.gif) -->

## Try it

> *(deployed URL goes here after the GitHub Pages workflow lands the first publish)*

Locally:

```bash
git clone https://github.com/aaryansinha16/MotionMag.git
cd MotionMag
npm install
npm run dev
```

Open the local URL Vite prints. Click **Start**, allow webcam. Wait ~10 seconds. Try the dropdown.

## The cog catalog

A *cog* is a small module that retunes one shared pipeline. Adding a new effect = adding one file in [`src/cogs/`](src/cogs/) and one line in the registry.

| Cog | Band (Hz) | What it reveals |
|---|---|---|
| `pulse-finder` | 0.8–2.5 | Heartbeat in your face + BPM readout |
| `micro-blush` | 0.2–1.0 | Slow emotion-driven blood-flow shifts |
| `micro-expression` | 0.5–5 | Quick involuntary facial movements |
| `infant-breathing` | 0.2–0.8 | Slow respiration visualisation (face) |
| `breath-from-color` | 0.1–0.5 | Breath-rate color shifts |
| `tremor-amp` | 4–12 | Hand or object tremor |
| `flag-wave` | 0.3–2 | Curtain / flag turbulence |
| `glass-of-water` | 1–10 | Sub-millimetre surface vibrations |

Three more are designed but not yet shipped: `string-vibration` and `screen-flicker` need ≥ 60 fps capture (current pipeline is 30 fps), and `breath-motion` needs phase-based EVM (see [DECISIONS.md](DECISIONS.md) D-004).

## How it works in 30 seconds

1. **Capture** the webcam at 640×480 @ 30 fps.
2. **Pyramid** — build a 4-level Gaussian pyramid on the GPU.
3. **Bandpass** — apply a per-pixel Butterworth biquad in the cog's frequency band. Everything outside that band gets thrown away.
4. **Amplify** — multiply the filtered signal by α (default 50×) and add it back to the original frame.
5. **Display** — the 0.5 % skin-color wobble becomes a 25 % wobble; your heartbeat shows up on screen.

The math is from the [MIT CSAIL 2012 paper](http://people.csail.mit.edu/mrub/papers/vidmag.pdf) by Wu et al. The packaging — browser-only, modular, eight different "magnify X" effects in one page — is what's new here.

## Privacy

- All processing runs in your browser via WebGL2 fragment shaders.
- No video data leaves your device, ever.
- No analytics, no third-party scripts, no cookies.
- MediaPipe Face Landmarker (used by the face-ROI cogs) loads its WASM runtime and model from this site's own origin — not Google's CDN.
- Open DevTools → Network on a cold reload. Click Start. You should see fetches for the JS, CSS, WASM, and model — all from this origin. Nothing else.

## Built on

- [Vite](https://vitejs.dev/) + TypeScript (strict, no `any`)
- WebGL2 fragment shaders for the pyramid + temporal bandpass + amplify pipeline
- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) for the forehead ROI on face-based cogs (self-hosted)
- [Vitest](https://vitest.dev/) for the biquad-coefficient unit tests

## Architecture

- [`src/pipeline/`](src/pipeline/) — `capture`, `display`, `pyramid`, `temporal`, `amplify`, `face-roi`, `pulse-meter`
- [`src/cogs/`](src/cogs/) — one file per effect, all matching the [`Cog`](src/cogs/types.ts) interface
- [`src/shaders/`](src/shaders/) — `passthrough`, `pyramid-down`, `biquad-bandpass`, `amplify` — text imported via Vite's `?raw` suffix
- [`src/ui/`](src/ui/) — `controls`, `styles`, `perf-overlay`

The repo lays out its decision trail in markdown — [`CLAUDE.md`](CLAUDE.md) for project instructions, [`DECISIONS.md`](DECISIONS.md) for architecture choices, [`PROJECT_PLAN.md`](PROJECT_PLAN.md) for the milestone roadmap, [`MEMORY.md`](MEMORY.md) for the running session log.

## Run, build, test

```bash
npm run dev      # Vite dev server (auto-opens browser)
npm run build    # static output in dist/
npm run preview  # serve the built output
npm run test     # Vitest
npm run lint     # tsc --noEmit
```

## License

MIT. See [`LICENSE`](LICENSE).
