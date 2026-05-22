#version 300 es
precision highp float;

// 5×5 Gaussian downsample (Burt-Adelson [1,4,6,4,1] / 16, separable kernel
// collapsed into a single fragment-shader convolution). The 2× decimation
// is implicit: the destination framebuffer is half the source's resolution,
// so each output texel naturally lands at every-other-source-texel.
//
// Total weight = 16 × 16 = 256, applied as the final divisor.

in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uSrcTexel; // (1.0 / srcWidth, 1.0 / srcHeight)
out vec4 outColor;

const float W[5] = float[5](1.0, 4.0, 6.0, 4.0, 1.0);

void main() {
  vec4 sum = vec4(0.0);
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 off = vec2(float(i), float(j)) * uSrcTexel;
      sum += W[i + 2] * W[j + 2] * texture(uSrc, vUV + off);
    }
  }
  outColor = sum / 256.0;
}
