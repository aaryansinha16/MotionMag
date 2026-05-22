# MotionMag — Running Memory

> Live state of the project. Updated at the end of each working session. The top three sections (Active milestone, Open questions, Useful snippets) are the source of truth for "where are we right now?" The session log at the bottom is the audit trail.

## Active milestone

**M1 — WebGL2 Gaussian pyramid.**

Acceptance: per-frame 4-level Gaussian pyramid built on the GPU; any chosen level renders correctly to screen; frame time under 16ms on the dev machine. See `PROJECT_PLAN.md` for the full task list.

## What's done

- Project mission, architecture, and tech stack documented in `CLAUDE.md`.
- Initial architectural decisions captured in `DECISIONS.md` (D-001 through D-010).
- Phased roadmap in `PROJECT_PLAN.md`.
- Five-star project exploration doc in `docs/five-star-projects.md`.
- **M0 complete (2026-05-23):** Vite + TS strict scaffold, baseline UI shell, `Camera` class wrapping `getUserMedia` at 640×480 @ 30fps, webcam feed renders on a 2D canvas via `requestVideoFrameCallback`. Manually verified end-to-end on dev machine.

## What's next (M1 task list)

1. Replace the 2D canvas context with a WebGL2 context (keep the same `<canvas id="output">`).
2. Per frame, upload `Camera.getVideoElement()` to a WebGL texture (use `texImage2D` with the `HTMLVideoElement` overload).
3. Create `src/pipeline/pyramid.ts`:
   - 4 downsample passes using `src/shaders/pyramid-down.frag` (5×5 Gaussian + 2× decimation).
   - Output stored as 4 ping-pong textures (level 0 = full, level 3 = 80×60 at 640×480 capture).
4. Add a "level picker" UI control (radio buttons 0/1/2/3) wired so we can verify each pyramid level renders correctly.
5. Add a perf overlay: FPS counter + per-frame ms (using the timestamps `requestVideoFrameCallback` already gives us).
6. Update this file's session log with what shipped and bump the active milestone to M2.

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

### 2026-05-23 — M0 shipped (scaffold + camera feed)
- Bootstrap commit on `main` (677c3a1): existing docs + MIT `LICENSE` (2026, Aaryan Sinha) + Vite-flavored `.gitignore`. Rebased onto the pre-existing remote initial commit; no force push.
- GitHub workflow set up: labels (`milestone-0`, `infra`, `pipeline`, `ui`, `docs`), one issue per M0 task (#1–#6), micro-PR-per-issue.
- PR #7 `m0/scaffold` (40ff679): Vite 5 + TypeScript strict (target ES2022, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vitest in devDeps, baseline `index.html` with heading + Start button + `<canvas id="output">`, `src/ui/styles.css`, `src/ui/controls.ts` (typed DOM ref helpers), `public/favicon.svg`. **Layout deviation:** `index.html` lives at project root (Vite default) instead of `src/ui/index.html` from CLAUDE.md's target layout — kept Vite config zero-friction; other UI module files still live under `src/ui/`. Revisit with a D-011 entry if the target layout becomes load-bearing.
- PR #8 `m0/camera-capture` (8d137a1): `src/pipeline/capture.ts` exporting `Camera` (640×480 @ 30fps, `facingMode: 'user'`, audio off) plus a typed `CameraError` with `denied | unavailable | unsupported | unknown` reasons; `src/main.ts` wires Start → permission prompt → `requestVideoFrameCallback` pump → 2D canvas, with `requestAnimationFrame` fallback and `pagehide` teardown.
- Manually verified end-to-end: dev server opens, Start triggers permission prompt, raw webcam renders on the canvas.
- Bundle: 3.62 KB JS / 1.60 KB gzipped after capture lands — well under the 200 KB initial-JS budget.
- Next session: M1 — replace 2D context with WebGL2, build the 4-level Gaussian pyramid in shaders, add level-picker radios and a perf overlay.
