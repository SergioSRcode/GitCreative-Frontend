#version 300 es

in vec2 a_position;
in vec2 a_localPos;     // -1 to 1 across the dab, regardless of actual pixel size
uniform vec2 u_resolution;
out vec2 v_localPos;

void main() {
  vec2 normalised = a_position / u_resolution;
  vec2 clipSpace  = normalised * vec2(2.0, -2.0) + vec2(-1.0, 1.0);
  gl_Position = vec4(clipSpace, 0.0, 1.0);
  v_localPos = a_localPos;
}