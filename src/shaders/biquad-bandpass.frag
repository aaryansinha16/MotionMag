#version 300 es
precision highp float;

// One section of a biquad bandpass applied to the green channel of the
// input, per pixel. RBJ Audio EQ Cookbook bandpass, a0-normalised:
//
//   y[n] = b0·x[n] + b1·x[n-1] + b2·x[n-2] − a1·y[n-1] − a2·y[n-2]
//
// State texel layout (RGBA16F):
//   .r = x[n-1]   ← becomes x[n-2] next frame
//   .g = x[n-2]
//   .b = y[n-1]   ← becomes y[n-2] next frame; also the freshly-written y[n]
//                   that downstream stages sample
//   .a = y[n-2]
//
// Ping-pong is managed on the CPU: this shader always reads `uState` (the
// previous frame's slot) and writes to a different bound framebuffer.

in vec2 vUV;
uniform sampler2D uInput;
uniform sampler2D uState;
uniform vec4 uNum;  // (b0, b1, b2, _)
uniform vec2 uDen;  // (a1, a2)
out vec4 outState;

void main() {
  float xN  = texture(uInput, vUV).g;
  vec4  prev = texture(uState, vUV);
  float xN1 = prev.r;
  float xN2 = prev.g;
  float yN1 = prev.b;
  float yN2 = prev.a;

  float yN =
      uNum.x * xN
    + uNum.y * xN1
    + uNum.z * xN2
    - uDen.x * yN1
    - uDen.y * yN2;

  outState = vec4(xN, xN1, yN, yN1);
}
