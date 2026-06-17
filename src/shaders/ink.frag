#version 300 es
precision mediump float;

uniform vec4 u_color;
out vec4 fragColor;

void main() {
  // Flat solid colour — no falloff, crisp edge defined purely by the geometry
  fragColor = u_color;
}