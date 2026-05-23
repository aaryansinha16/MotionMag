# MotionMag — Running Memory

> Live state of the project. Updated at the end of each working session. The top three sections (Active milestone, Open questions, Useful snippets) are the source of truth for "where are we right now?" The session log at the bottom is the audit trail.

## Active milestone

**M4 — Cog architecture + first three cogs.**

Acceptance: three cogs visible in a dropdown (pulse-finder, breath-from-color, tremor-amp), switching between them works without page reload or pipeline errors, each cog has a 5-second demo MP4 in `public/demos/`. See `PROJECT_PLAN.md` for the full task list.

## What's done

- Project mission, architecture, and tech stack documented in `CLAUDE.md`.
- Initial architectural decisions captured in `DECISIONS.md` (D-001 through D-010).
- Phased roadmap in `PROJECT_PLAN.md`.
- Five-star project exploration doc in `docs/five-star-projects.md`.
- **M0 complete (2026-05-23):** Vite + TS strict scaffold, baseline UI shell, `Camera` class wrapping `getUserMedia` at 640×480 @ 30fps, webcam feed renders on a 2D canvas via `requestVideoFrameCallback`. Manually verified end-to-end on dev machine.
- **M1 complete (2026-05-23):** WebGL2 substrate, per-frame texture upload, 4-level Gaussian pyramid on the GPU, L0–L3 level picker, FPS + per-frame-ms overlay. All four pyramid levels render correctly; budget verified on dev machine.
- **M2 complete (2026-05-23):** Per-pixel Butterworth biquad bandpass (RBJ cookbook) on the green channel at pyramid L2, amplification + reconstruction with an alpha slider (0–200, default 50). Pulse becomes visible after ~5–15 s filter transient. 7-test Vitest suite for biquad coefficient correctness and band response.
- **M3 complete (2026-05-23):** Lazy-loaded MediaPipe Face Landmarker (Vite chunk-split — main bundle stays at 8.22 KB gz), forehead bbox extraction (mesh indices 10/9/67/297 with 10% inset), scalar pulse meter that reuses `biquadBandpassCoeffs` from `temporal.ts`, BPM estimation via positive-going zero-crossings over a 10 s window with `[40, 200]` clamp and ±3 BPM stability gate, "♥ N BPM" overlay anchored top-left of the canvas.

## What's next (M4 task list)

1. Define the `Cog` interface in `src/cogs/types.ts` (matches what's already in `CLAUDE.md`: `id`, `displayName`, `bandHz`, `amplification`, `pyramidLevel`, `roi?`, `postprocess?`).
2. Create the cog registry `src/cogs/index.ts` and a `getAllCogs()` accessor.
3. Refactor the current pulse demo into `src/cogs/pulse-finder.ts` — moves the hard-coded constants (`TEMPORAL_LEVEL = 2`, default α, band 0.8–2.5 Hz, ROI = forehead, BPM postprocess) into a single cog object.
4. Add `src/cogs/breath-from-color.ts` — same pipeline, band 0.1–0.5 Hz, no BPM display, just visible breathing-rate color shift on the face.
5. Add `src/cogs/tremor-amp.ts` — full-frame (no ROI), band 4–12 Hz, useful for hand-tremor visualisation; pyramid level 0 or 1.
6. Replace the L0/L1/L2/L3 view radios with a cog dropdown (debug levels can stay as a separate hidden-by-default toggle).
7. Record a 5 s demo MP4 per cog into `public/demos/`.
8. Update this file's session log with what shipped and bump the active milestone to M5.

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

### 2026-05-23 — M3 shipped (face ROI + scalar pulse meter + BPM overlay)
- Added `milestone-3` label; opened issues #26–#31 (one per M3 task).
- PR #32 `m3/face-roi` (28af658): `src/pipeline/face-roi.ts` lazy-loads `@mediapipe/tasks-vision` via a TypeScript dynamic `import()` so Vite splits MediaPipe into its own chunk (~38 KB gz). Main bundle stays at **7.58 KB gz** vs 6.25 KB before — well under the 25 KB cap. WASM + model fetched from jsDelivr / Google's mediapipe-models CDNs on first Start (one-time fetch on user action, not page load). Forehead bbox uses canonical mesh indices 10/9/67/297 with a 10% inset; exposes pixel and normalised coords (CSS % overlay auto-scales with the canvas). A DOM debug rectangle traces the ROI for eyeballing. Detection runs only in Pulse view.
- PR #33 `m3/bpm-readout` (feb6f9e): `src/pipeline/pulse-meter.ts` samples mean green inside the forehead ROI via an offscreen 2D canvas (reallocates only on bbox size change), streams it through a scalar streaming biquad that reuses `biquadBandpassCoeffs` from `temporal.ts` — no duplicated math between shader and CPU side. BPM estimated via positive-going zero-crossings over a 10 s sliding window, with 5 s warmup, `[40, 200]` clamp (defends against 60 Hz mains aliasing per Q2 without an explicit notch), and a ±3 BPM stability gate that suppresses single-frame jitter. UI: "♥ N BPM" overlay anchored top-left of the canvas (DOM, not GL); states are hidden / "— BPM" / "♥ N BPM".
- Bundle after M3: **22.24 KB JS / 8.22 KB gzipped** main + **125 KB JS / 38 KB gzipped** on-demand vision_bundle chunk. Initial-bundle budget intact.
- Open quality threads (carry-forward): `index.html` location (see M0 entry), state-texture NEAREST upsample blockiness from M2, green-only filtering. New M3 open thread: model/WASM fetched from third-party CDNs on first Start — self-hosting is an M5 polish task to fully restore "no traffic after page load" claim.
- 60 Hz mains notch filter (Q2) is currently handled by the BPM clamp, not a separate filter. If real-world testing shows misbehaviour, add an explicit notch in a small follow-up.
- Self-merged through M3 per the same one-off override used in M2. Default rule (`Never self-merge`) restores from the next session.
- Next session: M4 — cog architecture + first three cogs (pulse-finder, breath-from-color, tremor-amp).

### 2026-05-23 — M2 shipped (temporal IIR + amplification + reconstruction)
- Added `milestone-2` and `tests` labels; opened issues #19–#22 (one per M2 task).
- PR #23 `m2/temporal-bandpass` (402e67b): RBJ Audio EQ Cookbook bandpass coefficients (`biquadBandpassCoeffs`), a reference `applyBiquad` in plain JS, and the GL temporal module (`initTemporal`, `setTemporalBand`, `processTemporal`) with per-pixel state ping-pong'd in RGBA16F textures (requires `EXT_color_buffer_float`). `src/shaders/biquad-bandpass.frag` applies one biquad section per pass on the green channel; state texel packs `(x[n-1], x[n-2], y[n-1], y[n-2])` and downstream samples `.b` for `y[n]`. 7-test Vitest suite covering cookbook structure (`b0 = -b2`, `b1 = 0`), stability (`|a2| < 1`), invalid-band rejection, in-band gain ≈ unity, 10 Hz stopband < 0.1 RMS, passband/stopband ratio >8× (single biquad rolls off at ~6 dB/octave, not 12 — caught when an initial 10× threshold was wrong), DC blocking. Module isn't wired in this PR; tree-shaking keeps the bundle flat at 11.10 KB / 4.42 KB gz.
- PR #24 `m2/amplify-and-wire` (8d9a97d): `src/pipeline/amplify.ts` + `src/shaders/amplify.frag` (`output = clamp(input + α · filteredBand, 0, 1)`, broadcasting filtered green to all three RGB channels so the face brightens/dims rather than chroma-shifting). `main.ts` wires the full pipeline `capture → pyramid → bandpass @ L2 → amplify → display`. Level picker re-labels L0 → "Pulse" with L1/L2/L3 as raw debug views. Alpha slider (0–200, default 50) updates live without restarting. `TEMPORAL_LEVEL = 2` is hardcoded per D-008 — becomes a cog field in M4.
- Bundle after M2: **17.61 KB JS / 6.25 KB gzipped** (~3× M1 because temporal + amplify are now reachable from `main.ts`). Still well under the 200 KB initial-JS budget.
- Self-merged through M2 (and the M1 close-out) per a one-off user override. Default rule (`Never self-merge` in `motionmag-workflow.md`) restores from the next session.
- Open thread carried forward: `index.html` location (see M0 entry below).
- Open quality threads: filtered state texture uses NEAREST → upsample from 160×120 to canvas is blocky (good enough for "see the pulse"; a pyramid-up shader is the future fix). Filtering is green-only for v0 — multi-channel filtering will need its own ADR if perf budget allows.
- Next session: M3 — MediaPipe Face Landmarker, forehead ROI, scalar pulse extraction, BPM readout.

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
