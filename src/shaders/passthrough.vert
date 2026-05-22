#version 300 es

// Fullscreen-triangle trick: three vertices cover the viewport with no overdraw
// and no vertex buffer. The vertex IDs map directly to clip-space corners:
//   id 0 → (-1, -1)   id 1 → ( 3, -1)   id 2 → (-1,  3)

out vec2 vUV;

void main() {
  float x = -1.0 + 4.0 * float(gl_VertexID == 1);
  float y = -1.0 + 4.0 * float(gl_VertexID == 2);
  vUV = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
