// 4-level Gaussian pyramid (per DECISIONS.md D-008). Level 0 is the input
// texture itself; levels 1–3 are owned by this module, allocated as
// half-resolution RGBA8 textures with a framebuffer per level so each
// downsample pass can render directly into the next level.
//
// At 640×480 input the levels resolve to:
//   L0 → 640×480 (the input texture, not owned)
//   L1 → 320×240
//   L2 → 160×120
//   L3 →  80× 60

import passthroughVert from '../shaders/passthrough.vert?raw';
import pyramidDownFrag from '../shaders/pyramid-down.frag?raw';
import { buildProgram, GLError } from './gl-utils';

export const PYRAMID_LEVEL_COUNT = 4;

export class PyramidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PyramidError';
  }
}

interface OwnedLevel {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
}

export interface PyramidLevelView {
  readonly texture: WebGLTexture;
  readonly width: number;
  readonly height: number;
}

export interface PyramidContext {
  readonly gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly uSrcTexelLoc: WebGLUniformLocation | null;
  downsampledLevels: OwnedLevel[];
  baseWidth: number;
  baseHeight: number;
}

export function initPyramid(gl: WebGL2RenderingContext): PyramidContext {
  let program: WebGLProgram;
  try {
    program = buildProgram(gl, passthroughVert, pyramidDownFrag);
  } catch (err) {
    if (err instanceof GLError) throw new PyramidError(`Pyramid ${err.message}`);
    throw err;
  }

  const vao = gl.createVertexArray();
  if (!vao) throw new PyramidError('Could not allocate pyramid VAO.');

  gl.useProgram(program);
  const uSrcLoc = gl.getUniformLocation(program, 'uSrc');
  const uSrcTexelLoc = gl.getUniformLocation(program, 'uSrcTexel');
  if (uSrcLoc) gl.uniform1i(uSrcLoc, 0);

  return {
    gl,
    program,
    vao,
    uSrcTexelLoc,
    downsampledLevels: [],
    baseWidth: 0,
    baseHeight: 0,
  };
}

// Runs the 3 downsample passes (input → L1 → L2 → L3). Re-allocates
// owned textures + FBOs lazily when input dimensions change.
export function processPyramid(
  ctx: PyramidContext,
  inputTexture: WebGLTexture,
  inputWidth: number,
  inputHeight: number,
): void {
  if (inputWidth === 0 || inputHeight === 0) return;
  ensureAllocated(ctx, inputWidth, inputHeight);

  const { gl } = ctx;
  gl.useProgram(ctx.program);
  gl.bindVertexArray(ctx.vao);
  gl.activeTexture(gl.TEXTURE0);

  let srcTexture = inputTexture;
  let srcW = inputWidth;
  let srcH = inputHeight;

  for (const level of ctx.downsampledLevels) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, level.framebuffer);
    gl.viewport(0, 0, level.width, level.height);
    gl.bindTexture(gl.TEXTURE_2D, srcTexture);
    if (ctx.uSrcTexelLoc) gl.uniform2f(ctx.uSrcTexelLoc, 1 / srcW, 1 / srcH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    srcTexture = level.texture;
    srcW = level.width;
    srcH = level.height;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

export function getLevelView(
  ctx: PyramidContext,
  inputTexture: WebGLTexture,
  inputWidth: number,
  inputHeight: number,
  level: number,
): PyramidLevelView {
  if (level === 0) {
    return { texture: inputTexture, width: inputWidth, height: inputHeight };
  }
  const lvl = ctx.downsampledLevels[level - 1];
  if (!lvl) {
    throw new PyramidError(`Pyramid level ${level} out of range (0..${PYRAMID_LEVEL_COUNT - 1}).`);
  }
  return { texture: lvl.texture, width: lvl.width, height: lvl.height };
}

function ensureAllocated(ctx: PyramidContext, inputWidth: number, inputHeight: number): void {
  if (
    ctx.baseWidth === inputWidth &&
    ctx.baseHeight === inputHeight &&
    ctx.downsampledLevels.length === PYRAMID_LEVEL_COUNT - 1
  ) {
    return;
  }

  for (const lvl of ctx.downsampledLevels) {
    ctx.gl.deleteTexture(lvl.texture);
    ctx.gl.deleteFramebuffer(lvl.framebuffer);
  }
  ctx.downsampledLevels = [];

  let w = inputWidth;
  let h = inputHeight;
  for (let i = 1; i < PYRAMID_LEVEL_COUNT; i++) {
    w = Math.max(1, Math.floor(w / 2));
    h = Math.max(1, Math.floor(h / 2));
    ctx.downsampledLevels.push(allocateLevel(ctx.gl, w, h));
  }

  ctx.baseWidth = inputWidth;
  ctx.baseHeight = inputHeight;
}

function allocateLevel(gl: WebGL2RenderingContext, width: number, height: number): OwnedLevel {
  const texture = gl.createTexture();
  if (!texture) throw new PyramidError('Could not allocate pyramid level texture.');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  // NEAREST filtering on the pyramid levels so that when a low-res level is
  // upsampled to the canvas you see the actual pyramid pixels (rather than
  // a smoothly-bilinear blur that hides whether the math is right).
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new PyramidError('Could not allocate pyramid level framebuffer.');
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new PyramidError(`Pyramid level framebuffer incomplete (status 0x${status.toString(16)}).`);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { texture, framebuffer, width, height };
}
