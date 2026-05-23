// Shared WebGL2 helpers: shader compilation, program linking.
// Kept narrow on purpose — anything broader belongs in the calling
// pipeline module so module ownership stays clear.

export class GLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GLError';
  }
}

export function buildProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) throw new GLError('Could not allocate program object.');

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '<no info log>';
    gl.deleteProgram(program);
    throw new GLError(`Program link failed: ${log}`);
  }

  // Shaders are flagged for deletion now; they'll be freed once the program
  // releases its reference. The program keeps working until we delete it.
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new GLError('Could not allocate shader object.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '<no info log>';
    gl.deleteShader(shader);
    throw new GLError(`Shader compile failed: ${log}`);
  }
  return shader;
}
