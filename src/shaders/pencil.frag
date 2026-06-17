#version 300 es
precision mediump float;

uniform vec4 u_color;
in vec2 v_localPos;
in vec2 v_worldPos;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float dist = length(v_localPos);
  float falloff = 1.0 - smoothstep(0.4, 1.0, dist);

  // Sample grain from the dab's actual canvas position, not its local
  // coordinate — this means overlapping dabs sample DIFFERENT noise,
  // creating a broken, grainy texture instead of a uniform blur
  float grain = hash(floor(v_worldPos * 0.8));

  // Push the contrast harder — grain should sometimes nearly vanish,
  // not just dim slightly
  float alpha = falloff * mix(0.15, 1.0, grain);

  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}