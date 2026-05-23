// Reconstruction: output = original + α · filtered_band
//
// Reads the full-resolution input frame (pyramid L0 = the camera texture)
// and the temporal state texture (which carries y[n] in its .b channel,
// produced by `pipeline/temporal.ts`). The filtered band typically lives
// at a lower pyramid level than the input, so the sampler upsamples it
// implicitly when the amplify shader reads at full-res UVs.

import passthroughVert from '../shaders/passthrough.vert?raw';
import amplifyFrag from '../shaders/amplify.frag?raw';
import { buildProgram, GLError } from './gl-utils';

export class AmplifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmplifyError';
  }
}

export interface AmplifyContext {
  readonly gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly uAlphaLoc: WebGLUniformLocation | null;
}

export function initAmplify(gl: WebGL2RenderingContext): AmplifyContext {
  let program: WebGLProgram;
  try {
    program = buildProgram(gl, passthroughVert, amplifyFrag);
  } catch (err) {
    if (err instanceof GLError) throw new AmplifyError(`Amplify ${err.message}`);
    throw err;
  }

  const vao = gl.createVertexArray();
  if (!vao) throw new AmplifyError('Could not allocate amplify VAO.');

  gl.useProgram(program);
  const uInputLoc = gl.getUniformLocation(program, 'uInput');
  const uFilteredLoc = gl.getUniformLocation(program, 'uFiltered');
  const uAlphaLoc = gl.getUniformLocation(program, 'uAlpha');
  if (uInputLoc) gl.uniform1i(uInputLoc, 0);
  if (uFilteredLoc) gl.uniform1i(uFilteredLoc, 1);

  return { gl, program, vao, uAlphaLoc };
}

// Composites α·filtered onto the input and draws to the currently-bound
// framebuffer. Caller is responsible for binding the target and setting
// the viewport (typically: null framebuffer + canvas-sized viewport).
export function drawAmplified(
  ctx: AmplifyContext,
  inputTexture: WebGLTexture,
  filteredStateTexture: WebGLTexture,
  alpha: number,
): void {
  const { gl } = ctx;
  gl.useProgram(ctx.program);
  gl.bindVertexArray(ctx.vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, inputTexture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, filteredStateTexture);
  if (ctx.uAlphaLoc) gl.uniform1f(ctx.uAlphaLoc, alpha);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
