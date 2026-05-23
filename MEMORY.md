# MotionMag — Running Memory

> Live state of the project. Updated at the end of each working session. The top three sections (Active milestone, Open questions, Useful snippets) are the source of truth for "where are we right now?" The session log at the bottom is the audit trail.

## Active milestone

**M2 — Temporal IIR bandpass + amplification + reconstruction.**

Acceptance: pointing the camera at a face shows visible pulsing in the cheeks/forehead within 5 s of Start; biquad band-response test passes; per-frame ms still under 16 ms. The hardest milestone — see `PROJECT_PLAN.md` for the full task list.

## What's done

- Project mission, architecture, and tech stack documented in `CLAUDE.md`.
- Initial architectural decisions captured in `DECISIONS.md` (D-001 through D-010).
- Phased roadmap in `PROJECT_PLAN.md`.
- Five-star project exploration doc in `docs/five-star-projects.md`.
- **M0 complete (2026-05-23):** Vite + TS strict scaffold, baseline UI shell, `Camera` class wrapping `getUserMedia` at 640×480 @ 30fps, webcam feed renders on a 2D canvas via `requestVideoFrameCallback`. Manually verified end-to-end on dev machine.
- **M1 complete (2026-05-23):** WebGL2 substrate, per-frame texture upload, 4-level Gaussian pyramid on the GPU, L0–L3 level picker, FPS + per-frame-ms overlay. All four pyramid levels render correctly; budget verified on dev machine.

## What's next (M2 task list)

1. Create `src/pipeline/temporal.ts`:
   - Butterworth biquad bandpass coefficients (RBJ cookbook form) for the requested band (start: 0.8–2.5 Hz at 30 fps).
   - Per-pixel state (`x[n-1]`, `x[n-2]`, `y[n-1]`, `y[n-2]`) maintained in a ping-pong RGBA16F (or 32F) texture pair.
   - `src/shaders/biquad-bandpass.frag` applies one biquad section per pass.
2. Create `src/pipeline/amplify.ts`:
   - Multiply filtered band by α (start α = 50, expose as a UI slider).
   - Reconstruction shader adds amplified band back to the original frame.
3. Wire the full pipeline: capture → pyramid → bandpass at L2 → amplify → reconstruct → display.
4. Unit tests in `tests/temporal.test.ts`: known sinusoid in vs theoretical band response out, within tolerance. Wire `npm run test` to Vitest.
5. Update this file's session log with what shipped and bump the active milestone to M3.

## Open questions

- **Q1:** Does MediaPipe Face Landmarker WASM size hurt iOS Safari first-load enough to warrant a fallback? Defer until M2 when face ROI matters.
- **Q2:** How do we handle the lighting-flicker problem (60 Hz fluorescent lights aliasing into the pulse band at 30fps capture)? Likely a notch filter at the suspected mains frequency, but we won't know until we see real-world data.
- **Q3:** Should the cog picker live in the URL hash (`#cog=pulse-finder`) so demos can be linked? Lean yes, but defer until we have 3+ cogs.

## Useful snippets

### Run the dev loop
```bash
npm run dev
```

### Webcam constraints we'll use (see D-009)
```ts
const constraints: MediaStreamConstraints = {
  video: {
    width:  { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user',
  },
  audio: false,
};
```

### Vite shader-as-raw-text import
```ts
import pyramidDownFrag from '../shaders/pyramid-down.frag?raw';
```

### Quick perf measurement
```ts
const t0 = performance.now();
// ...processing...
console.debug(`frame: ${(performance.now() - t0).toFixed(2)}ms`);
```

## Known dead-ends (don't try these again)

*(empty — will fill as we hit them)*

## Session log

### 2026-05-23 — Project initialized
- Created `CLAUDE.md`, `DECISIONS.md`, `MEMORY.md`, `PROJECT_PLAN.md`, `README.md`.
- Created `docs/five-star-projects.md` covering the four ★★★★★ "wait what" projects.
- Locked in tech stack: Vite + TS + WebGL2 + plain DOM. No backend, no framework.
- Locked in algorithmic approach: color-based EVM first, IIR Butterworth bandpass, 4-level Gaussian pyramid, 640×480 capture.
- Next session: scaffold Vite project and ship M0 (camera feed visible).

### 2026-05-23 — M1 shipped (WebGL2 pyramid + level picker + perf overlay)
- Added `milestone-1` and `perf` labels; opened issues #10–#14 (one per M1 task).
- PR #15 `m1/webgl-passthrough` (47d3a37): swapped the 2D canvas context for WebGL2, uploaded each video frame to a `TEXTURE_2D`, and rendered it back via a fullscreen-triangle passthrough program. Introduced `DisplayContext` and `DisplayError` so the pyramid PR could plug in without disturbing `main.ts`. `UNPACK_FLIP_Y_WEBGL` keeps the webcam right-side-up; `texImage2D` only re-allocates on dimension changes (`texSubImage2D` for steady-state frames).
- PR #16 `m1/pyramid` (fb9a7cf): added `src/pipeline/pyramid.ts` (4-level Gaussian, lazy-allocated per input size) plus `src/shaders/pyramid-down.frag` (5×5 [1,4,6,4,1]/16 Burt-Adelson kernel, single-pass 25-tap, 2× decimation via half-res FBO). Extracted shared shader plumbing into `src/pipeline/gl-utils.ts` (`buildProgram`, `GLError`). Split `drawVideoFrame` into `uploadVideoFrame` + `drawTexture` so the pyramid sits between them. UI gained an L0–L3 fieldset; `PYRAMID_LEVEL_COUNT` exported as the source of truth for the radio count. Pyramid level textures use NEAREST filtering on purpose so the 80×60 → 640×480 upsample at L3 shows real pyramid pixels rather than a smooth bilinear blur.
- PR #17 `m1/perf-overlay` (5720b9d): DOM-only overlay anchored to the top-right of the canvas. Rolling 1-second FPS window + 30-frame mean per-frame ms, DOM throttled to 250 ms updates. `gl.finish()` before stopping the timer so the metric reflects real pipeline cost rather than CPU dispatch — adds a small sync stall but it's the only way to verify the 16 ms budget without `EXT_disjoint_timer_query_webgl2`.
- Manually verified: L0 passes through, L3 shows visibly blocky 80×60 pixels stretched to canvas, FPS overlay reads sensible numbers.
- Bundle: **11.10 KB JS / 4.42 KB gzipped** after M1 — still well under the 200 KB initial-JS budget.
- Open thread carried forward: `index.html` location (see M0 entry below).
- Next session: M2 — Butterworth biquad bandpass + amplification + reconstruction; this is the milestone where pulse becomes visible.

### 2026-05-23 — M0 shipped (scaffold + camera feed)
- Bootstrap commit on `main` (677c3a1): existing docs + MIT `LICENSE` (2026, Aaryan Sinha) + Vite-flavored `.gitignore`. Rebased onto the pre-existing remote initial commit; no force push.
- GitHub workflow set up: labels (`milestone-0`, `infra`, `pipeline`, `ui`, `docs`), one issue per M0 task (#1–#6), micro-PR-per-issue.
- PR #7 `m0/scaffold` (40ff679): Vite 5 + TypeScript strict (target ES2022, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vitest in devDeps, baseline `index.html` with heading + Start button + `<canvas id="output">`, `src/ui/styles.css`, `src/ui/controls.ts` (typed DOM ref helpers), `public/favicon.svg`. **Layout deviation:** `index.html` lives at project root (Vite default) instead of `src/ui/index.html` from CLAUDE.md's target layout — kept Vite config zero-friction; other UI module files still live under `src/ui/`. Revisit with a D-011 entry if the target layout becomes load-bearing.
- PR #8 `m0/camera-capture` (8d137a1): `src/pipeline/capture.ts` exporting `Camera` (640×480 @ 30fps, `facingMode: 'user'`, audio off) plus a typed `CameraError` with `denied | unavailable | unsupported | unknown` reasons; `src/main.ts` wires Start → permission prompt → `requestVideoFrameCallback` pump → 2D canvas, with `requestAnimationFrame` fallback and `pagehide` teardown.
- Manually verified end-to-end: dev server opens, Start triggers permission prompt, raw webcam renders on the canvas.
- Bundle: 3.62 KB JS / 1.60 KB gzipped after capture lands — well under the 200 KB initial-JS budget.
- Next session: M1 — replace 2D context with WebGL2, build the 4-level Gaussian pyramid in shaders, add level-picker radios and a perf overlay.
