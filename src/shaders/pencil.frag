#version 300 es
precision mediump float;

uniform vec4 u_color;
in vec2 v_localPos;   // position within the dab, -1 to 1 on each axis
out vec4 fragColor;

// Cheap pseudo-random hash — turns a 2D position into a 0-1 noise value
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float dist = length(v_localPos); // 0 at centre, 1 at edge of dab

  // Soft radial falloff — fully opaque in the middle, fading to 0 at the edge
  float falloff = 1.0 - smoothstep(0.5, 1.0, dist);

  // Grain — sample noise at a scale that gives small speckles, not large blobs
  float grain = hash(v_localPos * 40.0);

  // Multiply falloff by grain so edges break up unevenly, like pencil texture
  float alpha = falloff * mix(0.6, 1.0, grain);

  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}