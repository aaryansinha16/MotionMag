import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Mirror MediaPipe's WASM runtime into public/wasm/ so the deployed site
// serves it from our own origin (no jsDelivr fetch). The files come from
// node_modules — they're regenerated on every build and gitignored.
//
// They're large (~32 MB across three SIMD variants) but MediaPipe's loader
// only fetches one at runtime based on the browser's SIMD capability, so
// the wire cost is ~11 MB, not 32.
function copyMediaPipeWasm(): Plugin {
  return {
    name: 'motionmag-copy-mediapipe-wasm',
    buildStart() {
      const srcDir = resolve(projectRoot, 'node_modules/@mediapipe/tasks-vision/wasm');
      const destDir = resolve(projectRoot, 'public/wasm');
      mkdirSync(destDir, { recursive: true });
      for (const file of readdirSync(srcDir)) {
        copyFileSync(resolve(srcDir, file), resolve(destDir, file));
      }
    },
  };
}

export default defineConfig({
  // GitHub Pages serves project repos at https://<user>.github.io/<repo>/,
  // so absolute URLs like `/wasm/...` resolve only after this prefix is
  // applied. Set BASE_PATH=/ at build time for a custom-domain deploy.
  base: process.env.BASE_PATH ?? '/MotionMag/',
  plugins: [copyMediaPipeWasm()],
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
