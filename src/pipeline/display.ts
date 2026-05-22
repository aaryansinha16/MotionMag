// Display: owns the WebGL2 context, the input texture, and the passthrough
// program that copies the texture to the canvas. M1 ships only the
// passthrough; the pyramid module (next PR) will sit between the texture
// upload and the draw.

import passthroughVert from '../shaders/passthrough.vert?raw';
import passthroughFrag from '../shaders/passthrough.frag?raw';

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

  const program = buildProgram(gl, passthroughVert, passthroughFrag);

  const vao = gl.createVertexArray();
  if (!vao) throw new DisplayError('Could not allocate a vertex array object.');

  const inputTexture = gl.createTexture();
  if (!inputTexture) throw new DisplayError('Could not allocate the input texture.');
  gl.bindTexture(gl.TEXTURE_2D, inputTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { gl, canvas, program, vao, inputTexture, textureWidth: 0, textureHeight: 0 };
}

// Uploads the current video frame into the input texture and draws it to the
// canvas. Allocates the texture storage once (texImage2D) and only re-allocates
// if the video's dimensions change; subsequent frames use texSubImage2D so the
// driver can reuse the existing GPU buffer.
export function drawVideoFrame(ctx: DisplayContext, video: HTMLVideoElement): void {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) return;

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

  gl.viewport(0, 0, ctx.canvas.width, ctx.canvas.height);
  gl.useProgram(ctx.program);
  gl.bindVertexArray(ctx.vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, ctx.inputTexture);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function buildProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const program = gl.createProgram();
  if (!program) throw new DisplayError('Could not allocate program object.');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '<no info log>';
    gl.deleteProgram(program);
    throw new DisplayError(`Program link failed: ${log}`);
  }

  // Shaders are flagged for deletion now; they'll be freed once the program
  // releases its reference. The program keeps working until we delete it.
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  // Bind the sampler uniform to texture unit 0 once. Uniforms live on the
  // program object, so this survives across draws.
  gl.useProgram(program);
  const loc = gl.getUniformLocation(program, 'uTex');
  if (loc) gl.uniform1i(loc, 0);

  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new DisplayError('Could not allocate shader object.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '<no info log>';
    gl.deleteShader(shader);
    throw new DisplayError(`Shader compile failed: ${log}`);
  }
  return shader;
}
