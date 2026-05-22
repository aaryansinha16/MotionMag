# MotionMag — Project Plan

> Phased roadmap from empty repo to deployed catalog. Each milestone has explicit acceptance criteria. Do not start a milestone until the previous one is signed off in `MEMORY.md`'s session log.

## North star

A static webpage. The user opens it. Within 10 seconds, they're watching their own pulse become visible in their face. They send the link to a friend. By the end of the week, the page hosts a catalog of ten "magnify X" cogs and is doing the rounds on Hacker News and Twitter.

## Success metrics

- **Time-to-wow:** under 10 seconds from page load to visible pulse on a typical laptop.
- **Performance:** 30fps on M1 MacBook Air, 24fps on iPhone 13 / mid-range Android.
- **Catalog:** 10 cogs at v1.0.
- **Bundle size:** under 200KB initial JS, under 500KB total before lazy-loaded models.
- **Reach:** GitHub repo crosses 1k stars within 60 days of public launch.

---

## Milestone 0 — Scaffold and camera feed
**Goal:** Vite project boots, "Start" button shows webcam feed in a canvas.

**Tasks:**
1. `npm create vite@latest . -- --template vanilla-ts` (in current directory).
2. Configure `tsconfig.json` with strict mode and ES2022 target.
3. Create `src/ui/index.html` with a heading, a "Start" button, and a `<canvas id="output">`.
4. Create `src/pipeline/capture.ts` exporting a `Camera` class:
   - `async start(): Promise<MediaStream>`
   - `getVideoElement(): HTMLVideoElement`
   - Uses the constraints from `MEMORY.md` snippets.
5. Wire `main.ts`: on button click, start camera, copy each frame to the canvas via `requestVideoFrameCallback`.
6. Add `.gitignore`, `LICENSE` (MIT), and a minimal `README.md` (already drafted).
7. Confirm `npm run dev` works and webcam renders in canvas.

**Acceptance:** raw webcam feed renders on canvas at 30fps on the dev machine.

**Estimated effort:** 2–3 hours.

---

## Milestone 1 — WebGL2 Gaussian pyramid
**Goal:** Per-frame, build a 4-level Gaussian pyramid on the GPU and display any chosen level.

**Tasks:**
1. Replace the 2D canvas with a WebGL2 context.
2. Upload the `<video>` element as a texture each frame.
3. Create `src/pipeline/pyramid.ts`:
   - 4 downsample passes with `pyramid-down.frag` (5×5 Gaussian + 2× decimation).
   - Output stored as 4 ping-pong textures.
4. Create a "level picker" UI control (radio buttons 0/1/2/3) to verify each pyramid level renders correctly.
5. Add a perf overlay (FPS counter, per-frame ms).

**Acceptance:** All four pyramid levels render correctly. Frame time under 16ms on the dev machine.

**Estimated effort:** 1 day.

---

## Milestone 2 — Temporal IIR bandpass + amplification + reconstruction
**Goal:** Pulse-band amplification works on full frame. You can see *something* pulsing, even without face ROI.

**Tasks:**
1. Create `src/pipeline/temporal.ts`:
   - Generate Butterworth biquad coefficients for the requested band (e.g., 0.8–2.5 Hz at 30fps).
   - Per-pixel state stored in a texture pair (input/output of biquad).
   - Single fragment shader applies one biquad section per pass.
2. Create `src/pipeline/amplify.ts`:
   - Multiply filtered signal by α (start at α = 50, expose as a slider).
   - Add amplified band back to the original frame.
3. Wire pipeline: capture → pyramid → bandpass (at level 2) → amplify → reconstruct → display.
4. Unit tests in `tests/temporal.test.ts`: feed a known sinusoid through the filter, assert band response matches Butterworth theory within tolerance.

**Acceptance:**
- Pointing the camera at a face shows visible pulsing in the cheeks/forehead within 5 seconds of "Start."
- Test for biquad band response passes.
- Frame time still under 16ms.

**Estimated effort:** 2–3 days. This is the hardest milestone.

---

## Milestone 3 — Face ROI + scalar pulse extraction + BPM display
**Goal:** Clean pulse demo with a numeric BPM that updates live.

**Tasks:**
1. Lazy-load MediaPipe Face Landmarker on first activation of a face-ROI cog.
2. Extract a forehead bounding box from landmarks (points around the forehead region).
3. Average the green channel inside the forehead box per frame → scalar time series.
4. Apply the same Butterworth bandpass to the scalar series.
5. Estimate BPM via zero-crossing rate or peak-picking over a 10-second sliding window.
6. UI: display "♥ 72 BPM" overlay on the magnified canvas.

**Acceptance:**
- BPM reading stabilizes within 15 seconds of sitting still.
- Reading matches a fingertip pulse-ox or smartwatch reading within ±5 BPM under good lighting.
- Lighting-flicker case (60Hz fluorescent) does not produce false readings.

**Estimated effort:** 2 days.

---

## Milestone 4 — Cog architecture + first three cogs
**Goal:** A user can switch between cogs from a dropdown. Three cogs ship.

**Tasks:**
1. Define the `Cog` interface in `src/cogs/types.ts` (matches what's in `CLAUDE.md`).
2. Create the cog registry `src/cogs/index.ts`.
3. Refactor the M3 pulse demo into `src/cogs/pulse-finder.ts`.
4. Add `src/cogs/breath-from-color.ts` — same pipeline, bandpass at 0.1–0.5 Hz, no BPM display, just visible color change.
5. Add `src/cogs/tremor-amp.ts` — full-frame, no face ROI, band at 4–12 Hz, useful for hand tremor visualization.
6. Build a dropdown in the UI that lists registered cogs and switches active cog without page reload.

**Acceptance:**
- Three cogs visible in dropdown. Switching between them works without errors.
- Each cog has a 5-second demo MP4 in `public/demos/`.

**Estimated effort:** 2 days.

---

## Milestone 5 — Polish + mobile
**Goal:** Works smoothly on iPhone Safari and a mid-range Android.

**Tasks:**
1. Mobile-friendly responsive CSS (canvas scales to viewport).
2. Test on iPhone Safari — fix anything broken (likely: video constraints, autoplay permissions, shader precision).
3. Test on Android Chrome — fix anything broken (likely: WebGL extension availability).
4. Add an in-page "How does this work?" explainer with the EVM diagram.
5. Lighting-condition warnings — detect very low light or visible 60Hz flicker, suggest fixes.
6. Onboarding overlay: "Sit still, face the camera, good lighting, wait 5 seconds."

**Acceptance:**
- iPhone 13 hits 24fps, Pixel 7 / Galaxy S22 hits 24fps.
- Time-to-wow under 10 seconds measured on three friends who've never seen the demo.

**Estimated effort:** 3–4 days.

---

## Milestone 6 — Catalog expansion + deploy
**Goal:** 10 cogs total, live URL, README hero GIF.

**Cogs to add** (each is small once M4 is done):
- `micro-blush` — amplify face color in the 0.2–1.0 Hz band, reveals emotion-driven blood flow shifts.
- `breath-motion` *(deferred — needs phase-based EVM, see D-004)*.
- `string-vibration` — full-frame, 30–200 Hz band, point at a guitar string or piano string.
- `flag-wave` — full-frame, 0.3–2 Hz, point at curtains or a flag.
- `glass-of-water` — full-frame, 1–10 Hz, point at a glass to see footsteps.
- `screen-flicker` — full-frame, 50–120 Hz band, reveals PWM dimming of LEDs.
- `infant-breathing` — face ROI, 0.2–0.8 Hz, with "no-breathing for 15s" audible alert.
- `micro-expression` — face ROI, 0.5–5 Hz, slow + amplify face for tells.

**Deploy tasks:**
1. Set up Vercel / GitHub Pages / Cloudflare Pages.
2. Add custom domain if desired.
3. Record hero GIF (5 seconds of pulsing face) for the README.
4. Write the launch tweet thread and Hacker News post.
5. Add a `<noscript>` and a `<video>` fallback showing the demo for users who can't run it.

**Acceptance:**
- Live URL works on first visit, no errors.
- 10 cogs ship, each with a demo clip.
- README is screenshot/GIF-first, copy-second.

**Estimated effort:** 3–5 days.

---

## Stretch goals (v2+)

These get their own decision entries when picked up:

- **Phase-based EVM** for clean motion magnification (breathing chest motion, building sway).
- **WebGPU compute-shader port** once iOS Safari support is universal.
- **WASM-SIMD CPU fallback** for devices without WebGL2.
- **Multi-camera cogs** — Picture-in-picture with a second tab's camera.
- **Mobile-sensor cogs** — extend the platform to accelerometer, magnetometer, mic (the other side-channel projects from `docs/five-star-projects.md`).
- **Cog SDK** — let third parties publish cogs as standalone files users can drop in.
- **PWA** — installable, offline-capable.
- **Educational mode** — toggle on real-time visualization of the pyramid, the bandpass response, the amplified delta.

---

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Per-pixel IIR in WebGL is too slow on phones | High | Fall back to CPU SIMD; or reduce pyramid resolution further on mobile |
| MediaPipe WASM bundle hurts first-load | Medium | Lazy-load; show "loading face detector..." indicator |
| 60Hz fluorescent lighting swamps pulse band | Medium | Notch filter at suspected mains frequency; add lighting warning |
| iOS Safari WebGL2 quirks | Medium | Test early (M5), maintain a workaround log |
| Webcam access blocked or denied | Low | Clear permission prompt + fallback message |
| Project gets one cog working but never expands | High (kills the platform story) | Enforce "cog interface first, cog body second" in M4; don't ship without 3 cogs |

---

## Definition of v1.0

- 10 cogs live.
- Hosted on a real URL.
- 30fps desktop / 24fps mobile.
- Privacy promise verifiable (open DevTools → Network → confirm no traffic after page load).
- README has a hero GIF, a one-sentence pitch, and a list of cogs with thumbnails.
- MIT license, CONTRIBUTING.md, issues template.

After v1.0: pick the next ★★★★★ project from `docs/five-star-projects.md` or pursue a stretch goal.
