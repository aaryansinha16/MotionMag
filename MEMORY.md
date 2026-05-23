# MotionMag — Running Memory

> Live state of the project. Updated at the end of each working session. The top three sections (Active milestone, Open questions, Useful snippets) are the source of truth for "where are we right now?" The session log at the bottom is the audit trail.

## Active milestone

**M6 — Catalog expansion + deploy.**

Acceptance: 10 cogs total, hosted on a live URL, hero GIF in the README. See `PROJECT_PLAN.md` for the full task list.

Carry-overs into M6:
- **Demo MP4 recordings (#41)** — still a manual user action.
- **Manual iPhone / Android device test (#50)** — code-side polish landed in M5; on-device verification is user-side.
- **Self-host MediaPipe WASM + model** — would restore the "no traffic after page load" claim. Worth its own PR before the public launch.

## What's done

- Project mission, architecture, and tech stack documented in `CLAUDE.md`.
- Initial architectural decisions captured in `DECISIONS.md` (D-001 through D-010).
- Phased roadmap in `PROJECT_PLAN.md`.
- Five-star project exploration doc in `docs/five-star-projects.md`.
- **M0 complete (2026-05-23):** Vite + TS strict scaffold, baseline UI shell, `Camera` class wrapping `getUserMedia` at 640×480 @ 30fps, webcam feed renders on a 2D canvas via `requestVideoFrameCallback`. Manually verified end-to-end on dev machine.
- **M1 complete (2026-05-23):** WebGL2 substrate, per-frame texture upload, 4-level Gaussian pyramid on the GPU, L0–L3 level picker, FPS + per-frame-ms overlay. All four pyramid levels render correctly; budget verified on dev machine.
- **M2 complete (2026-05-23):** Per-pixel Butterworth biquad bandpass (RBJ cookbook) on the green channel at pyramid L2, amplification + reconstruction with an alpha slider (0–200, default 50). Pulse becomes visible after ~5–15 s filter transient. 7-test Vitest suite for biquad coefficient correctness and band response.
- **M3 complete (2026-05-23):** Lazy-loaded MediaPipe Face Landmarker (Vite chunk-split — main bundle stays at 8.22 KB gz), forehead bbox extraction (mesh indices 10/9/67/297 with 10% inset), scalar pulse meter that reuses `biquadBandpassCoeffs` from `temporal.ts`, BPM estimation via positive-going zero-crossings over a 10 s window with `[40, 200]` clamp and ±3 BPM stability gate, "♥ N BPM" overlay anchored top-left of the canvas. User confirmed BPM and ROI rectangle both work on the dev machine.
- **M4 complete (2026-05-23):** Cog architecture in `src/cogs/` — `Cog` interface, registry, three shipping cogs (`pulse-finder`, `breath-from-color`, `tremor-amp`). Dropdown UI replaces the M1-era L0–L3 view radios; the level radios are no longer user-facing (still in git history for anyone who wants them). Live cog switching updates band, pyramid level, α default, ROI requirement, and postprocess without page reload.
- **M5 complete (2026-05-23):** Mobile-best-practices polish — responsive CSS at ≤ 540 px with stacked controls + dvh viewport + 44 px tap targets, `getUserMedia` `OverconstrainedError` retry for Safari mobile, first-time onboarding overlay (sessionStorage-scoped), low-light warning piggy-backed on the pulse meter, in-page "How does this work?" explainer with inline-SVG pipeline diagram. On-device verification (#50) and demo MP4s (#41) deferred to M6.

## What's next (M6 task list)

1. Expand the catalog toward 10 cogs (see `PROJECT_PLAN.md` for the candidate list): `micro-blush`, `string-vibration`, `flag-wave`, `glass-of-water`, `screen-flicker`, `infant-breathing`, `micro-expression`. `breath-motion` deferred per D-004 (needs phase-based EVM).
2. Hosting: pick a static host (GitHub Pages / Cloudflare Pages / Vercel); set up a build → deploy pipeline.
3. Optional custom domain.
4. Record the hero GIF for the README (5 s of pulsing face).
5. Self-host MediaPipe WASM + model so the privacy story is airtight (carry-over).
6. Launch artefacts: tweet thread + HN post draft.
7. Record demo MP4s for the three shipping cogs (carry-over from #41).
8. Manual iPhone / Android device validation (carry-over from #50).
9. `<noscript>` fallback + a `<video>` poster of the demo for users who can't run WebGL2.
10. Update this file's session log with what shipped, mark the project at v1.0.

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

### 2026-05-23 — M5 shipped (polish + mobile)
- Added `milestone-5` label; opened issues #45–#50 (five implementation + one manual-test carry).
- PR #51 `m5/responsive-mobile` (f9c4bd3): body uses `100dvh` with `100vh` fallback so iOS Safari's collapsing URL bar doesn't crop layout; `.app__button` min-height 44 px (Apple HIG / Material tap target); `@media (max-width: 540px)` stacks controls vertically and lets the cog dropdown + α slider stretch to full width. In `src/pipeline/capture.ts`, `getUserMedia` rejected with `OverconstrainedError` now retries once with `{ facingMode: 'user' }` — mobile Safari sometimes can't honour the strict 640×480 @ 30 fps but happily serves a usable lower-res stream the second time.
- PR #52 `m5/onboarding-lighting` (183e9ed): first-time onboarding overlay (modal-style, dismissed by tap / Escape / Enter / Space or 8 s timeout; sessionStorage suppresses subsequent Starts in the same tab). Low-light warning piggy-backs on the green sample the pulse meter already computes — exposed `PulseMeter.getLastRawGreen()` on the interface; if it stays below 0.15 ([0,1] range) for 3 s while Pulse cog is active, an amber chip surfaces under the status line and recovers on its own. Lighting check only fires for cogs that sample skin pixels (only `pulse-finder` today).
- PR #53 `m5/explainer` (8a3eadf): collapsible `<details>` block beneath the controls. Inline-SVG pipeline diagram (Camera → Pyramid → Bandpass → Amplify → Display) sized in `viewBox` coords so it scales with the canvas. Plain-language three-beat explanation plus a numbered step-by-step that ties each pipeline stage back to the cog architecture. Credit + link to Wu et al., MIT CSAIL 2012. No JS — vanilla `<details>`/`<summary>` and CSS `::after` for the +/− indicator.
- Bundle after M5: **24.47 KB JS / 9.12 KB gzipped** main + 6.50 KB HTML / 2.34 KB gz (the SVG explainer is the heaviest non-JS asset now). Vision chunk unchanged at 125 KB / 38 KB gz, still on-demand.
- **iPhone Safari / Android Chrome on-device tests are still pending (#50)** — what shipped is mobile-best-practices code; actual device verification requires user hands on a phone. Same story for demo MP4s (#41) — manual recording.
- 60 Hz mains notch filter (`MEMORY.md` Q2): no change. The `[40, 200]` BPM clamp from M3 still covers the failure mode well enough; promote to a real notch when real-world data shows misbehaviour.
- Self-merged through M5 per the same one-off override. Default rule (`Never self-merge` in `motionmag-workflow.md`) restores from next session.
- Next session: M6 — catalog expansion toward 10 cogs (micro-blush, string-vibration, flag-wave, glass-of-water, screen-flicker, infant-breathing, micro-expression), pick a static host, record the hero GIF, ideally self-host MediaPipe to close the privacy story before public launch.

### 2026-05-23 — M4 shipped (cog architecture + three cogs)
- Added `milestone-4` and `cog` labels; opened issues #35–#41 (six implementation + one carry-over for demo MP4s).
- User confirmed M3 works on the dev machine: BPM overlay reads sensible numbers, ROI rectangle lands on the forehead. BPM accuracy validation deferred until they have a BPM monitor on hand.
- PR #42 `m4/cog-architecture` (aa4b2ab): added `src/cogs/{types,index,pulse-finder}.ts`. `main.ts` no longer hard-codes `TEMPORAL_LEVEL = 2` or the L0/L1/L2/L3 view switch — pipeline reads band, pyramid level, α default, ROI requirement, and postprocess from the active cog. `applyActiveCog` handles live switches (re-points `setTemporalBand`, resets `pulseMeter`, snaps α slider to cog default, lazy-loads MediaPipe only when ROI = 'forehead'). UI: `<fieldset id="level-picker">` replaced by `<select id="cog">` populated from the registry at startup. Pulse view behaves identically to M3.
- PR #43 `m4/cogs-breath-tremor` (e29b457): added `src/cogs/breath-from-color.ts` (0.1–0.5 Hz, full-frame, L2, α=100, `slowSettle: true`) and `src/cogs/tremor-amp.ts` (4–12 Hz, full-frame, L1, α=30). Both files are pure config — no pipeline changes — which is the "platform, not demo" architectural payoff of #42 actually paying out. Filter coefficient sanity for both bands verified (Q + ω₀ within stable / well-behaved ranges).
- **Divergence from CLAUDE.md** in `src/cogs/types.ts`: `postprocess` is a string discriminator (`'pulse-bpm'`) instead of a closure. Closure form would need to reach into pulse-meter scalar state — coupling that isn't paying for itself with one postprocess kind. Documented inline; promote to a closure when a second postprocess type lands.
- Bundle after M4: **23.18 KB JS / 8.69 KB gzipped** main + **125 KB / 38 KB gz** on-demand `vision_bundle` chunk. Initial-bundle budget intact (still ~4 % of the 200 KB ceiling).
- Demo MP4s (#41) deferred to M5 as a manual recording task — code can't ship the videos.
- Open quality threads carried forward: `index.html` location (M0); state-texture NEAREST upsample blockiness (M2); green-only filtering (M2); third-party CDN fetches for MediaPipe WASM + model on first Start (M3); explicit 60 Hz mains notch filter (M3, handled by the BPM clamp until data shows misbehaviour).
- Self-merged through M4 per the same one-off override. Default rule (`Never self-merge` in `motionmag-workflow.md`) restores from the next session.
- Next session: M5 — mobile compatibility (iPhone Safari, Android Chrome), responsive CSS, in-page explainer, lighting-condition warnings, onboarding overlay, demo MP4 recordings.

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
