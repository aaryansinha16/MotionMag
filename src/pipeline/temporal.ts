// Per-pixel temporal bandpass — the centerpiece of M2.
//
// We isolate the requested frequency band (default 0.8–2.5 Hz, the pulse
// range) with a single Butterworth-equivalent biquad section in the
// RBJ Audio EQ Cookbook bandpass form (https://www.w3.org/TR/audio-eq-cookbook/).
//
// State (x[n-1], x[n-2], y[n-1], y[n-2]) per pixel is packed into a single
// RGBA16F texel and ping-pong'd between two framebuffer-bound textures so
// frame n reads from one slot and writes to the other.
//
// v0 filters only the green channel (the rPPG literature's preference for
// skin-pulse detection: hemoglobin absorbs green strongly). The filtered
// output appears in the `.b` channel of the returned state texture; the
// amplify module multiplies by α and adds it back to all three input
// channels.

import passthroughVert from '../shaders/passthrough.vert?raw';
import biquadBandpassFrag from '../shaders/biquad-bandpass.frag?raw';
import { buildProgram, GLError } from './gl-utils';

export class TemporalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporalError';
  }
}

export interface BiquadCoeffs {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
}

// RBJ Audio EQ Cookbook, bandpass (constant 0 dB peak gain), a0-normalised.
//   f₀ = √(f_low · f_high)    (geometric centre)
//   Q  = f₀ / (f_high − f_low)
//   ω₀ = 2π · f₀ / fs
//   α  = sin(ω₀) / (2Q)
//
//   b0 =  α        a0 = 1 + α       (then divide everything by a0)
//   b1 =  0        a1 = −2·cos(ω₀)
//   b2 = −α        a2 = 1 − α
export function biquadBandpassCoeffs(
  fLowHz: number,
  fHighHz: number,
  sampleRateHz: number,
): BiquadCoeffs {
  if (!(fHighHz > fLowHz && fLowHz > 0 && sampleRateHz > 0)) {
    throw new TemporalError(
      `Invalid biquad band: fLow=${fLowHz}, fHigh=${fHighHz}, fs=${sampleRateHz}`,
    );
  }
  const f0 = Math.sqrt(fLowHz * fHighHz);
  const Q = f0 / (fHighHz - fLowHz);
  const w0 = (2 * Math.PI * f0) / sampleRateHz;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * cosw0) / a0,
    a2: (1 - alpha) / a0,
  };
}

// Reference biquad implementation in plain JS; the fragment shader mirrors
// this math exactly. Kept here so the unit tests can verify cookbook
// correctness without needing a WebGL context.
export function applyBiquad(coeffs: BiquadCoeffs, samples: readonly number[]): number[] {
  const N = samples.length;
  const out: number[] = new Array<number>(N).fill(0);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < N; i++) {
    const x0 = samples[i] ?? 0;
    const y0 =
      coeffs.b0 * x0 +
      coeffs.b1 * x1 +
      coeffs.b2 * x2 -
      coeffs.a1 * y1 -
      coeffs.a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

interface StateSlot {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
}

export interface TemporalContext {
  readonly gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly uNumLoc: WebGLUniformLocation | null;
  readonly uDenLoc: WebGLUniformLocation | null;
  coeffs: BiquadCoeffs;
  ping: StateSlot | null;
  pong: StateSlot | null;
  current: 0 | 1;
  width: number;
  height: number;
}

export function initTemporal(gl: WebGL2RenderingContext): TemporalContext {
  // Rendering to RGBA16F needs this extension. Universal on mid-2026 browsers
  // (iOS Safari 16+, modern Chrome / Firefox / Edge).
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new TemporalError(
      'EXT_color_buffer_float is not available — required for per-pixel filter state.',
    );
  }

  let program: WebGLProgram;
  try {
    program = buildProgram(gl, passthroughVert, biquadBandpassFrag);
  } catch (err) {
    if (err instanceof GLError) throw new TemporalError(`Temporal ${err.message}`);
    throw err;
  }

  const vao = gl.createVertexArray();
  if (!vao) throw new TemporalError('Could not allocate temporal VAO.');

  gl.useProgram(program);
  const uInputLoc = gl.getUniformLocation(program, 'uInput');
  const uStateLoc = gl.getUniformLocation(program, 'uState');
  const uNumLoc = gl.getUniformLocation(program, 'uNum');
  const uDenLoc = gl.getUniformLocation(program, 'uDen');
  if (uInputLoc) gl.uniform1i(uInputLoc, 0);
  if (uStateLoc) gl.uniform1i(uStateLoc, 1);

  return {
    gl,
    program,
    vao,
    uNumLoc,
    uDenLoc,
    coeffs: biquadBandpassCoeffs(0.8, 2.5, 30),
    ping: null,
    pong: null,
    current: 0,
    width: 0,
    height: 0,
  };
}

export function setTemporalBand(
  ctx: TemporalContext,
  fLowHz: number,
  fHighHz: number,
  sampleRateHz: number,
): void {
  ctx.coeffs = biquadBandpassCoeffs(fLowHz, fHighHz, sampleRateHz);
}

// Runs one biquad section at the given input. Returns the freshly-written
// state texture; downstream samples `.b` for the filtered y[n] signal.
export function processTemporal(
  ctx: TemporalContext,
  inputTexture: WebGLTexture,
  width: number,
  height: number,
): WebGLTexture {
  if (width === 0 || height === 0) {
    if (!ctx.ping) throw new TemporalError('Temporal cannot run on zero-sized input.');
    return ctx.ping.texture;
  }
  ensureAllocated(ctx, width, height);

  const { gl, ping, pong, coeffs } = ctx;
  if (!ping || !pong) throw new TemporalError('Temporal slots not allocated.');

  const readSlot = ctx.current === 0 ? ping : pong;
  const writeSlot = ctx.current === 0 ? pong : ping;

  gl.useProgram(ctx.program);
  gl.bindVertexArray(ctx.vao);
  gl.bindFramebuffer(gl.FRAMEBUFFER, writeSlot.framebuffer);
  gl.viewport(0, 0, width, height);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, inputTexture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, readSlot.texture);

  if (ctx.uNumLoc) gl.uniform4f(ctx.uNumLoc, coeffs.b0, coeffs.b1, coeffs.b2, 0);
  if (ctx.uDenLoc) gl.uniform2f(ctx.uDenLoc, coeffs.a1, coeffs.a2);

  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  ctx.current = ctx.current === 0 ? 1 : 0;
  return writeSlot.texture;
}

function ensureAllocated(ctx: TemporalContext, width: number, height: number): void {
  if (ctx.width === width && ctx.height === height && ctx.ping && ctx.pong) return;

  for (const slot of [ctx.ping, ctx.pong]) {
    if (slot) {
      ctx.gl.deleteTexture(slot.texture);
      ctx.gl.deleteFramebuffer(slot.framebuffer);
    }
  }

  ctx.ping = allocateSlot(ctx.gl, width, height);
  ctx.pong = allocateSlot(ctx.gl, width, height);
  ctx.current = 0;
  ctx.width = width;
  ctx.height = height;
}

function allocateSlot(gl: WebGL2RenderingContext, width: number, height: number): StateSlot {
  const texture = gl.createTexture();
  if (!texture) throw new TemporalError('Could not allocate temporal state texture.');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA16F,
    width,
    height,
    0,
    gl.RGBA,
    gl.HALF_FLOAT,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new TemporalError('Could not allocate temporal state framebuffer.');
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new TemporalError(
      `Temporal state framebuffer incomplete (status 0x${status.toString(16)}).`,
    );
  }
  // Zero-initialise the state so the first frame starts with x[*]=y[*]=0.
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { texture, framebuffer };
}
