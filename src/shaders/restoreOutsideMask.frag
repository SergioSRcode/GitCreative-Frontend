#version 300 es
precision mediump float;

uniform sampler2D u_original;  // pre-erase content
uniform sampler2D u_current;   // post-erase content
uniform sampler2D u_mask;      // selection mask
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec4 original = texture(u_original, v_texCoord);
  vec4 current  = texture(u_current, v_texCoord);
  float maskAlpha = texture(u_mask, v_texCoord).a;

  // Inside the selection (maskAlpha near 1): keep the erased (current) result
  // Outside the selection (maskAlpha near 0): revert to the original pixels
  fragColor = mix(original, current, maskAlpha);
}