# Architecture Decisions

ADR-lite log. One entry per meaningful technical choice. Append-only — when a decision is reversed, write a new entry that references and supersedes the old one rather than editing in place.

Format: `## D-NNN — Title` · *Date · Status · Decided by*

---

## D-001 — Browser-only, no backend, ever
*2026-05-23 · Accepted*

**Context.** The project's defining promise is privacy-by-construction: webcam frames never leave the device. A server, even for "harmless" things like analytics or model hosting, breaks the promise and gives users a reason to distrust the demo.

**Decision.** All processing happens in the browser. There is no server-side code in this repo. The deployment target is a static-file host (GitHub Pages, Cloudflare Pages, Netlify, or equivalent). Any feature that would require a backend (account login, saved videos, social sharing of magnified clips) is explicitly out of scope for v1 and would need its own decision entry.

**Consequences.** We accept the performance cost of running EVM in WebGL instead of a server-side CUDA pipeline. We accept that we cannot collect telemetry to debug performance issues — we ship dev tooling for users to send manual reports if they want.

---

## D-002 — Vite + TypeScript, no UI framework
*2026-05-23 · Accepted*

**Context.** The demo is a single page with a webcam feed, a cog picker, and a few controls. Picking React/Next/Svelte introduces hundreds of KB of framework code and a build-time setup tax for what is effectively a side-by-side `<canvas>` + a dropdown.

**Decision.** Vite as the build tool. TypeScript with strict mode. UI is plain DOM + a small `controls.ts` module that wires events. Add a framework only if/when the UI grows past ~3 stateful components.

**Consequences.** Faster dev loop (Vite HMR on TS is milliseconds). Smaller bundle, faster mobile load. We hand-write event handlers — not painful at this scale.

---

## D-003 — WebGL2 over WebGPU for v0
*2026-05-23 · Accepted*

**Context.** WebGPU is the right long-term answer for shader-heavy work — compute shaders, better profiling, modern API. But as of mid-2026 it is still unevenly supported on mobile Safari (partial since iOS 18) and on older Android browsers. WebGL2 ships everywhere we care about.

**Decision.** v0 ships WebGL2 fragment shaders only. Re-evaluate for v2 once iOS Safari WebGPU is universal.

**Consequences.** Slightly more verbose shader pipeline (no compute shaders means temporal filtering happens either on CPU or with ping-pong textures). We isolate shader code in `src/shaders/` so a future WebGPU port is a swap, not a rewrite.

---

## D-004 — Color-based EVM first, motion (phase-based) EVM later
*2026-05-23 · Accepted*

**Context.** EVM has two flavors: the original 2012 color-based version, which amplifies per-pixel intensity changes in a temporal band, and the 2013 phase-based version, which uses a complex steerable pyramid to amplify motion specifically. Phase-based gives much cleaner motion magnification (less ringing, less noise amplification) but the math is significantly heavier — complex steerable pyramids, multi-orientation filters, phase unwrapping.

**Decision.** v0 ships color-based EVM only. The hero demo (pulse from face) only needs color magnification — the signal *is* color change. Motion-magnification cogs (breathing chest motion, hand tremor, guitar string vibration) are deferred until v1 phase-based pipeline.

**Consequences.** First three cogs (pulse-finder, breath-from-color, micro-blush) work in v0. Cogs needing structural-motion amplification wait. Acceptance: pulse demo working before any other cog development starts.

---

## D-005 — IIR Butterworth bandpass, not FFT
*2026-05-23 · Accepted*

**Context.** Temporal filtering can be done either (a) buffer N frames and FFT the time axis per pixel, then zero out off-band coefficients, or (b) run an IIR (e.g., Butterworth) bandpass per pixel with maintained state across frames.

FFT: clean stopband, but requires a multi-second buffer (latency), heavy per-frame cost, and you re-process the whole window every frame.

IIR: a few multiply-adds per pixel per frame, constant memory per pixel (the filter state), zero latency beyond the filter's own group delay.

**Decision.** Per-pixel IIR Butterworth bandpass. Second-order biquad cascade is sufficient for pulse-band isolation. Filter state is stored in a WebGL texture alongside the frame data (ping-pong).

**Consequences.** Real-time at 30fps becomes feasible. Stopband leakage requires careful coefficient design — first thing tested in `tests/temporal.test.ts`.

---

## D-006 — Cogs as ES modules with a registry
*2026-05-23 · Accepted*

**Context.** RuView's catalog of 105 cogs is part of what makes it feel like a platform, not a demo. We want the same property: a clear extension point so dropping in a new file appears in the UI dropdown.

**Decision.** Each cog is a single TypeScript file in `src/cogs/` exporting a default object matching the `Cog` interface declared in `CLAUDE.md`. A registry module (`src/cogs/index.ts`) imports them by name and exposes a `getAllCogs()` function. The UI dropdown is populated from that registry.

When the cog list grows beyond ~15, switch to Vite's `import.meta.glob` for auto-discovery.

**Consequences.** Adding a cog is one file + one line in the registry. No pipeline changes. Cogs cannot break each other because they share no mutable state — each cog reconfigures the pipeline at activation time only.

---

## D-007 — MediaPipe Face Landmarker for ROI, lazy-loaded
*2026-05-23 · Accepted*

**Context.** Pulse-from-face works best when sampled from the forehead (highly vascularized, less affected by facial expressions). We need a fast, accurate face landmark detector that runs in-browser without bloating the initial bundle.

Options considered:
- **face-api.js** — older, larger, less accurate on phones.
- **MediaPipe Face Landmarker (WASM/TFJS)** — Google's, ~3MB, runs at 30fps on mobile, 478 landmarks (overkill but fine).
- **No face detection** — fall back to a fixed central rectangle; works for sit-still demos but is fragile.

**Decision.** MediaPipe Face Landmarker, lazy-loaded only when a cog declares `roi: 'face'` or `'forehead'`. Initial bundle stays small for cogs that don't need it.

**Consequences.** Pulse cog has a one-time ~3MB download on first activation. Cogs that don't need face detection (full-frame magnification, micro-tremor on a hand) don't pay this cost.

---

## D-008 — Pyramid depth fixed at 4 levels
*2026-05-23 · Accepted*

**Context.** Gaussian pyramid depth trades off spatial detail vs. noise rejection. Deeper pyramids isolate lower spatial frequencies (slower-moving, broader phenomena like respiration) but blur away the high-frequency signal you need for thin-feature magnification.

**Decision.** v0 uses a fixed 4-level pyramid. Cogs declare which level(s) they want amplified. At 640×480 input, level 0 is 640×480, level 1 is 320×240, level 2 is 160×120, level 3 is 80×60.

**Consequences.** Pulse magnification uses level 2–3 (the signal is low-spatial-frequency skin redness). Tremor-amp uses level 0–1. If a future cog needs adaptive pyramid depth, this decision gets a successor.

---

## D-009 — Camera at 640×480, downscale higher
*2026-05-23 · Accepted*

**Context.** Higher-resolution webcam input gives prettier visuals but quadratically more work for the GPU pipeline. The pulse signal is low-spatial-frequency — going above 640×480 buys nothing for the actual magnification math.

**Decision.** Request the webcam at 640×480 @ 30fps via `getUserMedia` constraints. If the device delivers higher, downscale on capture. Display the magnified output upscaled with bilinear interpolation if the user's display is larger.

**Consequences.** Predictable performance budget. Loses some "look how sharp" appeal, but the pulse demo doesn't need it — the wow is in the motion, not the resolution.

---

## D-010 — Open source, MIT license
*2026-05-23 · Accepted*

**Context.** The MIT EVM reference code is freely available for research. The project's value is in the packaging, not the algorithm. Closing the source would slow adoption and contradict the "open the page and see for yourself" trust model.

**Decision.** MIT license. `LICENSE` file in repo root. Contributions welcome.

**Consequences.** Future commercial cogs (if any) live in separate repos. The base pipeline stays free forever.
