#version 300 es
precision mediump float;

uniform vec4 u_color;
uniform float u_hardness;  // 0.0 = soft, 0.5 = medium, 1.0 = hard
in vec2 v_localPos;
out vec4 fragColor;

void main() {
  float dist = length(v_localPos); // 0 at centre, 1 at edge

  // hardness controls where the falloff begins:
  // soft (0.0)   → falloff starts near the centre, wide soft gradient
  // hard (1.0)   → falloff starts near the edge, mostly solid with a thin soft rim
  float falloffStart = mix(0.0, 0.85, u_hardness);
  float alpha = 1.0 - smoothstep(falloffStart, 1.0, dist);

  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}