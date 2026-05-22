# MotionMag — Project instructions for Claude Code

> **The pitch in one sentence:** Open a web page, point your webcam at yourself, and watch your own pulse become visible in your face. Pure browser, no servers, no cameras-uploaded, no permissions beyond webcam.

## Project mission

Build a browser-only implementation of Eulerian Video Magnification (EVM) that runs at 30fps on a 2020-class laptop and on modern phones, packaged as a *catalog of cogs* (small magnify-X modules) rather than a single demo. The reference user experience: open a URL, click start, be amazed within ten seconds.

## Non-negotiables

- **All processing runs in the browser.** No video frame ever leaves the user's device. There is no backend. There will never be a backend.
- **No analytics, no telemetry, no third-party scripts.** The privacy story is the marketing.
- **Phone-compatible.** Mobile Safari and Chrome on Android must work, not just desktop.
- **Sub-second time-to-wow.** From page load to "I can see my pulse" should be under 10 seconds.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build tool | **Vite** | Fastest HMR, zero-config TS, tiny output |
| Language | **TypeScript** | Catch shape errors in the pipeline early |
| Rendering | **WebGL2 fragment shaders** | Broadest device support; WebGPU optional later |
| Camera | **getUserMedia + `<video>` → texture** | Standard pipeline |
| Face ROI (when needed) | **MediaPipe Face Landmarker (TFJS / WASM)** | Forehead-only signal extraction for clean pulse |
| UI | **Plain DOM + minimal CSS** | No framework until UI complexity demands one |
| Tests | **Vitest** | Unit tests for the temporal-filter math |
| Deploy | **Vercel** | Static, free, fast |

**Do not introduce** React, Next.js, a router, a state library, Tailwind, or any cloud SDK without first writing a decision entry in `DECISIONS.md` explaining why.

## Performance budget

- **30fps minimum** at 640×480 webcam capture on an M1 MacBook Air.
- **24fps minimum** on an iPhone 13 or equivalent Android.
- **End-to-end latency** (camera → magnified frame on screen) under 100ms.
- **Pyramid depth** capped at 4 levels; resolutions higher than 640×480 are downscaled.

If a change drops below these, fix it before merging.

## Architecture: pipeline + cogs

There is one shared pipeline:

```
getUserMedia → <video> → WebGL texture
   → Gaussian pyramid (shader)
   → Temporal IIR bandpass (CPU or shader, per-pixel state)
   → Amplifier (× α)
   → Reconstruction (sum back to original)
   → Display canvas
```

A **cog** is a small module that plugs into the pipeline by declaring:

```ts
interface Cog {
  id: string;                    // 'pulse-finder', 'breath-finder', etc.
  displayName: string;
  bandHz: [number, number];      // temporal bandpass range
  amplification: number;         // α
  pyramidLevel: number;          // which pyramid level to amplify
  roi?: 'face' | 'forehead' | 'full-frame' | { x; y; w; h };
  postprocess?: (signal: Float32Array) => { bpm?: number; label?: string };
}
```

Adding a new effect = adding a new cog file. No pipeline changes.

## File layout (target)

```
unique101/
├── CLAUDE.md            ← this file
├── DECISIONS.md         ← architecture decisions
├── MEMORY.md            ← running state, open questions
├── PROJECT_PLAN.md      ← phased roadmap
├── README.md            ← user-facing pitch
├── docs/
│   └── five-star-projects.md
├── src/
│   ├── main.ts                  ← entry, wires pipeline + active cog
│   ├── pipeline/
│   │   ├── capture.ts           ← getUserMedia wrapper
│   │   ├── pyramid.ts           ← Gaussian pyramid (WebGL)
│   │   ├── temporal.ts          ← IIR Butterworth bandpass
│   │   ├── amplify.ts           ← gain + reconstruction
│   │   └── display.ts           ← canvas compositor
│   ├── cogs/
│   │   ├── pulse-finder.ts
│   │   ├── breath-finder.ts
│   │   └── tremor-amp.ts
│   ├── shaders/
│   │   ├── pyramid-down.frag
│   │   ├── pyramid-up.frag
│   │   └── reconstruct.frag
│   └── ui/
│       ├── index.html
│       ├── styles.css
│       └── controls.ts
├── tests/
│   └── temporal.test.ts
├── public/
│   └── favicon.svg
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Code style

- TypeScript strict mode on. No `any` without a one-line comment justifying it.
- Functions over classes for the pipeline (state lives in closures or plain objects). Use classes only for stateful long-lived things like the camera capture.
- Shaders live as `.frag` / `.vert` text files imported via Vite's `?raw` suffix.
- Each pipeline module exports a single `init()` and a single `process(input) → output` function. No god-objects.
- Comments explain *why*, not *what*. The math gets a comment block with the equation; the rest is self-explanatory from naming.

## Commands (once scaffolded)

```bash
npm install            # one-time
npm run dev            # Vite dev server, opens browser
npm run build          # static output in dist/
npm run test           # Vitest
npm run lint           # eslint + tsc --noEmit
```

## What "done" looks like for each cog

A cog ships when:
1. It runs at the global performance budget (30fps desktop, 24fps mobile).
2. It has a one-line description in `README.md` and an entry in the cog picker UI.
3. The temporal filter coefficients have a unit test verifying band response.
4. There's a 5-second screen-recording GIF or short video in `/public/demos/<cog-id>.mp4`.

## Things to avoid

- **Don't add a backend.** Even for "just one thing." Pixels never leave the device.
- **Don't pull in a CV megaframework** (e.g., OpenCV.js wholesale, MediaPipe Tasks Vision wholesale). Use only what's needed for face ROI, lazy-loaded.
- **Don't optimize prematurely.** Get the IIR pipeline correct on CPU first, then port hot paths to shaders.
- **Don't ship a cog without a demo GIF.** The README is the product.

## When you (Claude) start working

1. Read `MEMORY.md` to learn current state and the active milestone.
2. Read `PROJECT_PLAN.md` for the milestone's acceptance criteria.
3. Check `DECISIONS.md` before introducing any new dependency or architectural choice.
4. When a milestone completes, append a "## Session log" entry to `MEMORY.md` with what changed and what's next.
5. If you make an architectural decision worth remembering, append it to `DECISIONS.md` (numbered, dated, with rationale).

## Git + GitHub workflow

- **Repo:** https://github.com/aaryansinha16/MotionMag
- **Local git config (already set):** `user.name = "Aaryan Sinha"`, `user.email = "aaryansinha16@gmail.com"`
- **CLI:** use `gh` for all GitHub operations (issues, PRs, merges).

The project is managed with **micro-PRs**. Every meaningful change follows:

> GitHub issue → feature branch → push → PR → user review → squash-merge → branch delete.

### Branch model

- `main` is always green. Only the initial bootstrap commit (project docs + license + .gitignore) lands directly on `main`. After that, no direct pushes.
- All work happens on short-lived feature branches off the latest `main`.
- Branch naming:
  - `m<N>/<short-slug>` — milestone work, e.g. `m0/scaffold`, `m1/pyramid`
  - `cog/<cog-id>` — new cogs, e.g. `cog/pulse-finder`
  - `fix/<short-slug>` — bug fixes
  - `docs/<short-slug>` — doc-only changes
  - `infra/<short-slug>` — build / CI / tooling
- Delete the branch after merge.

### Issue-per-task

Every task in `PROJECT_PLAN.md` becomes its own GitHub issue **before** any code is written. When starting a milestone:

1. Read the milestone's task list in `PROJECT_PLAN.md`.
2. Use `gh issue create` to open one issue per task.
3. Apply labels: `milestone-<N>` plus an area label (`pipeline`, `cog`, `ui`, `infra`, `docs`, `perf`, `tests`). Create missing labels with `gh label create`.
4. If a milestone has more than ~5 tasks, open a parent "tracking issue" with a checklist of the children.

Issue title format: `[M<N>] <imperative task title>` — e.g. `[M0] Scaffold Vite + TypeScript project`. Issue body should restate the relevant acceptance criteria from `PROJECT_PLAN.md`.

### Micro-PR philosophy

Smaller PRs beat big PRs every time.

- **Under 300 lines diff** (excluding lockfiles and generated files).
- **One logical change per PR.** "Scaffold project" and "Add camera capture" should be two PRs even within the same milestone, unless one is meaningless without the other.
- **Each PR closes its issue.** Use `Closes #N` in the PR description.
- **Independently reviewable and revertible.** If you can't summarize the PR in one sentence, split it.

### Commit messages

Conventional Commits, imperative mood, lowercase after the colon, no trailing period.

- `feat(capture): wire getUserMedia → canvas at 30fps`
- `fix(pyramid): correct edge-clamp on level 3 downsample`
- `test(temporal): verify Butterworth band response within 1dB`
- `docs(plan): mark M0 complete`
- `chore`, `refactor`, `perf`, `infra` also fine.

### PR description template

```
## What
One-paragraph summary of the change.

## Why
Why this change, why now. Link the milestone acceptance criterion it advances.

## Test plan
- [ ] `npm run dev` and verify <thing>
- [ ] `npm run test` passes
- [ ] Manual check: <thing>

Closes #<issue>
```

### Per-session loop

When you (Claude) start a milestone:

1. Read the milestone in `PROJECT_PLAN.md`.
2. Create one GitHub issue per task with `gh issue create` (apply labels).
3. For each issue (or tightly coupled group): `git checkout main && git pull && git checkout -b m<N>/<slug>`.
4. Do the work. Commit with conventional-commit messages. Push the branch.
5. Open the PR with `gh pr create` using the template above. Reference the issue.
6. **Stop and ask the user to review** — do not self-merge.
7. After user approves: `gh pr merge --squash --delete-branch`.
8. Return to `main`, pull, start the next branch.

Do not chain multiple un-reviewed branches on top of each other. Do not merge your own PRs without explicit go-ahead.

## Useful references

- MIT CSAIL paper: Wu et al., 2012, "Eulerian Video Magnification for Revealing Subtle Changes in the World" — `http://people.csail.mit.edu/mrub/papers/vidmag.pdf`
- Original MATLAB code: `http://people.csail.mit.edu/mrub/evm/`
- MediaPipe Face Landmarker: `https://developers.google.com/mediapipe/solutions/vision/face_landmarker`
- WebGL2 reference: `https://webgl2fundamentals.org/`
- rPPG (remote photoplethysmography) survey: McDuff et al., 2015.
