#version 300 es
precision mediump float;

uniform sampler2D u_mask;
uniform vec2 u_texelSize;   // 1.0 / canvas width, 1.0 / canvas height
uniform float u_time;       // seconds, drives the marching animation
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  float center = texture(u_mask, v_texCoord).a;

  // Sample four neighbors, offset by one texel
  float left  = texture(u_mask, v_texCoord + vec2(-u_texelSize.x, 0.0)).a;
  float right = texture(u_mask, v_texCoord + vec2( u_texelSize.x, 0.0)).a;
  float up    = texture(u_mask, v_texCoord + vec2(0.0,  u_texelSize.y)).a;
  float down  = texture(u_mask, v_texCoord + vec2(0.0, -u_texelSize.y)).a;

  // An "edge" pixel is inside the mask but has at least one neighbor outside it
  bool isInside = center > 0.5;
  bool hasOutsideNeighbor = (left < 0.5) || (right < 0.5) || (up < 0.5) || (down < 0.5);
  bool isEdge = isInside && hasOutsideNeighbor;

  if (!isEdge) {
    fragColor = vec4(0.0, 0.0, 0.0, 0.0);  // fully transparent, not part of the outline
    return;
  }

  // Marching ants pattern: alternating dash based on position + time,
  // using diagonal stripes (a common GPU trick — no true path parameterization
  // needed, since we don't have an ordered boundary path, just edge pixels)
  float dashLength = 6.0;
  float screenPos = (gl_FragCoord.x + gl_FragCoord.y) - u_time * 30.0;
  float dashPhase = mod(screenPos, dashLength * 2.0);
  bool isBlackDash = dashPhase < dashLength;

  fragColor = isBlackDash ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(1.0, 1.0, 1.0, 1.0);
}