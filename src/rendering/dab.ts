import { StrokePoint } from "../types/stroke";

const SEGMENTS = 16;  // number of triangle slices per circle - higher = smoother edge

export function buildDabVertices(point: StrokePoint, radius: number): number[] {
  const verts: number[] = [];
  const angleStep = (Math.PI * 2) / SEGMENTS;

  for (let i = 0; i < SEGMENTS; i++) {
    const angleA = i * angleStep;
    const angleB = (i + 1) * angleStep;

    const ax = point.x + Math.cos(angleA) * radius;
    const ay = point.y + Math.sin(angleA) * radius;
    const bx = point.x + Math.cos(angleB) * radius;
    const by = point.y + Math.sin(angleB) * radius;

    // TRIANGLE: center, edge point A, edge point B
    verts.push(point.x, point.y, ax, ay, bx, by);
  }

  return verts;
}