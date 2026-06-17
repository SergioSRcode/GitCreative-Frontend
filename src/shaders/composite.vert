#version 300 es

in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  // Full-screen quad is already in clip space — no conversion needed
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}