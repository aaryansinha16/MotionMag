#version 300 es
precision highp float;

// Reconstruction shader:  output = original + α · filtered_band
//
// `uInput`    is the full-resolution camera texture (RGBA8).
// `uFiltered` is the temporal state texture; the filtered y[n] is in .b.
//             It typically lives at a lower pyramid level (e.g. L2 at
//             160×120), so reading at full-res UVs upsamples it via the
//             sampler's filter mode.
//
// v0 broadcasts the filtered green channel to all three RGB channels of
// the input, so the face appears to brighten and dim with the pulse rather
// than shifting hue. Simpler to read than a chroma shift; M3+ can revisit
// once we have per-channel filtering.

in vec2 vUV;
uniform sampler2D uInput;
uniform sampler2D uFiltered;
uniform float uAlpha;
out vec4 outColor;

void main() {
  vec3 base = texture(uInput, vUV).rgb;
  float band = texture(uFiltered, vUV).b;
  vec3 boost = vec3(uAlpha * band);
  outColor = vec4(clamp(base + boost, 0.0, 1.0), 1.0);
}
