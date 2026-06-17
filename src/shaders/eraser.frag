#version 300 es
precision mediump float;

in vec2 v_localPos;
out vec4 fragColor;

void main() {
  float dist = length(v_localPos);
  float falloff = 1.0 - smoothstep(0.6, 1.0, dist);
  // Output alpha represents how much to erase — colour is irrelevant,
  // the renderer will use a blend mode that subtracts this alpha
  fragColor = vec4(0.0, 0.0, 0.0, falloff);
}