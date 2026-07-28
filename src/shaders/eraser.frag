#version 300 es
precision mediump float;

uniform float u_hard;  // 0.0 = soft falloff (default), 1.0 = hard edge, no falloff
in vec2 v_localPos;
out vec4 fragColor;

void main() {
  float dist = length(v_localPos);

  // Soft version: gradual falloff between 0.6 and 1.0 radius
  float softFalloff = 1.0 - smoothstep(0.6, 1.0, dist);

  // Hard version: fully opaque inside the circle, nothing outside — no gradient at all
  float hardFalloff = step(dist, 1.0);

  float falloff = mix(softFalloff, hardFalloff, u_hard);

  fragColor = vec4(0.0, 0.0, 0.0, falloff);
}