#version 300 es
precision mediump float;

uniform sampler2D u_layer;
uniform sampler2D u_backdrop;
uniform float u_opacity;
uniform int u_blendMode;

in vec2 v_texCoord;
out vec4 fragColor;

vec3 applyBlend(int mode, vec3 src, vec3 dst) {
  switch (mode) {
    case 0:                              // normal
      return src;

    case 1:                              // multiply
      return src * dst;

    case 2:                              // overlay
      // step(0.5, dst) returns 0.0 where dst < 0.5, 1.0 where dst >= 0.5
      // mix() uses that to switch between multiply-like and screen-like formula
      return mix(
        2.0 * src * dst,
        1.0 - 2.0 * (1.0 - src) * (1.0 - dst),
        step(0.5, dst)
      );

    default:
      return src;
  }
}

void main() {
  vec4 src = texture(u_layer,    v_texCoord);
  vec4 dst = texture(u_backdrop, v_texCoord);

  vec3 blended = applyBlend(u_blendMode, src.rgb, dst.rgb);

  // Alpha-composite the blended result over the backdrop
  // Where the layer is transparent, src.a is 0 and mix returns dst unchanged
  vec3 result = mix(dst.rgb, blended, src.a * u_opacity);
  float alpha  = dst.a + src.a * u_opacity * (1.0 - dst.a);

  fragColor = vec4(result, alpha);
}