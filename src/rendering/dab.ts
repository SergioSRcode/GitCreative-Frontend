import type { StrokePoint } from "../types/stroke";

const SEGMENTS = 16;  // number of triangle slices per circle - higher = smoother edge

// Returns interleaved [worldX, worldY, localX, localY, ...] per vertex
export function buildDabVertices(point: StrokePoint, radius: number): number[] {
  const verts: number[] = [];
  const angleStep = (Math.PI * 2) / SEGMENTS;

  for (let i = 0; i < SEGMENTS; i++) {
    const angleA = i * angleStep;
    const angleB = (i + 1) * angleStep;

    const cosA = Math.cos(angleA);
    const sinA = Math.sin(angleA);
    const cosB = Math.cos(angleB);
    const sinB = Math.sin(angleB);

    const ax = point.x + Math.cos(angleA) * radius;
    const ay = point.y + Math.sin(angleA) * radius;
    const bx = point.x + Math.cos(angleB) * radius;
    const by = point.y + Math.sin(angleB) * radius;

    // Centre vertex: world position = dab centre, local position = (0,0)
    // Edge vertices: world position = on the circle, local position = unit circle point
    verts.push(point.x, point.y, 0, 0,  ax, ay, cosA, sinA, bx, by, cosB, sinB);
  }

  return verts;
}