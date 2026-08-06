#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
uniform vec2 u_offsetClip;   // offset already converted to clip-space units
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position + u_offsetClip, 0.0, 1.0);
  v_texCoord = a_texCoord;
}