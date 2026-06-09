#version 300 es

in vec2 a_position;
uniform vec2 u_resolution;

void main() {
  // Convert pixel coords to clip space
  vec2 normalised = a_position / u_resolution;
  vec2 clipSpace  = normalised * vec2(2.0, -2.0) + vec2(-1.0, 1.0);
  gl_Position = vec4(clipSpace, 0.0, 1.0);
}