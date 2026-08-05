#version 300 es
precision mediump float;

uniform sampler2D u_target;   // the stroke content being clipped
uniform sampler2D u_mask;     // the selection mask
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec4 target = texture(u_target, v_texCoord);
  float maskAlpha = texture(u_mask, v_texCoord).a;

  // Multiply the stroke's own alpha by the mask's alpha —
  // outside the selection (mask alpha 0), the stroke becomes invisible
  fragColor = vec4(target.rgb, target.a * maskAlpha);
}