#version 300 es
precision mediump float;

uniform sampler2D u_texture;
uniform float u_opacity;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  fragColor = vec4(color.rgb, color.a * u_opacity);
}