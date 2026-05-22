// Display: owns the WebGL2 context, the input texture, and the passthrough
// program that copies a chosen texture to the canvas. M1's pyramid module
// sits between texture upload and final draw — it reads inputTexture and
// produces lower-resolution outputs that drawTexture then displays.

import passthroughVert from '../shaders/passthrough.vert?raw';
import passthroughFrag from '../shaders/passthrough.frag?raw';
import { buildProgram, GLError } from './gl-utils';

export class DisplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisplayError';
  }
}

export interface DisplayContext {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  readonly program: WebGLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly inputTexture: WebGLTexture;
  textureWidth: number;
  textureHeight: number;
}

export function initDisplay(canvas: HTMLCanvasElement): DisplayContext {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new DisplayError('WebGL2 is not available in this browser.');

  let program: WebGLProgram;
  try {
    program = buildProgram(gl, passthroughVert, passthroughFrag);
  } catch (err) {
    if (err instanceof GLError) throw new DisplayError(`Display ${err.message}`);
    throw err;
  }

  const vao = gl.createVertexArray();
  if (!vao) throw new DisplayError('Could not allocate a vertex array object.');

  const inputTexture = gl.createTexture();
  if (!inputTexture) throw new DisplayError('Could not allocate the input texture.');
  gl.bindTexture(gl.TEXTURE_2D, inputTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Bind the sampler uniform once.
  gl.useProgram(program);
  const loc = gl.getUniformLocation(program, 'uTex');
  if (loc) gl.uniform1i(loc, 0);

  return { gl, canvas, program, vao, inputTexture, textureWidth: 0, textureHeight: 0 };
}

// Uploads the current video frame into the input texture. Allocates the
// texture storage once (texImage2D) and only re-allocates if the video's
// dimensions change; subsequent frames use texSubImage2D so the driver can
// reuse the existing GPU buffer. Returns true when a real frame is now in
// the texture, false when the video isn't ready yet.
export function uploadVideoFrame(ctx: DisplayContext, video: HTMLVideoElement): boolean {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) return false;

  const { gl } = ctx;
  gl.bindTexture(gl.TEXTURE_2D, ctx.inputTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  if (w !== ctx.textureWidth || h !== ctx.textureHeight) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    ctx.textureWidth = w;
    ctx.textureHeight = h;
    if (ctx.canvas.width !== w || ctx.canvas.height !== h) {
      ctx.canvas.width = w;
      ctx.canvas.height = h;
    }
  } else {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
  }

  return true;
}

// Draws the given texture to the canvas via the passthrough program.
// Restores the default framebuffer and sizes the viewport to the canvas.
export function drawTexture(ctx: DisplayContext, texture: WebGLTexture): void {
  const { gl } = ctx;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, ctx.canvas.width, ctx.canvas.height);
  gl.useProgram(ctx.program);
  gl.bindVertexArray(ctx.vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
