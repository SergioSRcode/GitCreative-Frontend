import type { StrokePoint } from "../types/stroke";

// Calc distance between two points
function distance(a: StrokePoint, b: StrokePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  return Math.sqrt(dx * dx + dy * dy);
}

// Linearly interpolates (lerp) between two points
function lerp(a: StrokePoint, b: StrokePoint, t: number): StrokePoint {
  return {
    x:         a.x         + (b.x         - a.x)         * t,
    y:         a.y         + (b.y         - a.y)         * t,
    pressure:  a.pressure  + (b.pressure  - a.pressure)  * t,
    timeStamp: a.timeStamp + (b.timeStamp - a.timeStamp) * t,
  }
}

// Resample points so they are evenly spaced 'spacing' pixels apart
export function resample(points: StrokePoint[], spacing: number): StrokePoint[] {
  if (points.length < 2) return points;

  const result: StrokePoint[] =[points[0]];
  let accumulated = 0;

    for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const segmentLength = distance(prev, curr)

    // How far along this segment until the next resampled point
    const remaining = spacing - accumulated

    if (segmentLength < remaining) {
      // If segment is shorter than needed — accumulate and move on
      accumulated += segmentLength
    } else {
      // Walk along this segment placing points every `spacing` pixels
      let walked = remaining

      while (walked <= segmentLength) {
        const t = walked / segmentLength
        result.push(lerp(prev, curr, t))
        walked += spacing
      }
      accumulated = segmentLength - (walked - spacing)
    }
  }

  return result
}

// Smooths points using a sliding window average; 
// passes equals the number of times smoothing occurs
export function smooth(points: StrokePoint[], passes: number = 2): StrokePoint[] {
  if (points.length < 3) return points;

  let result = [...points];

  for (let pass = 0; pass < passes; pass++) {
    const smoothed = [result[0]]; // keeping the first point

    for (let i = 1; i < result.length - 1; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      const next = result[i + 1];

      // Weighting the current point more heavily helps preserve stroke shape
      smoothed.push({
        x:         prev.x         * 0.25 + curr.x         * 0.5 + next.x         * 0.25,
        y:         prev.y         * 0.25 + curr.y         * 0.5 + next.y         * 0.25,
        pressure:  prev.pressure  * 0.25 + curr.pressure  * 0.5 + next.pressure  * 0.25,
        timeStamp: curr.timeStamp,
      });
    }

    smoothed.push(result[result.length - 1]);  // keeping the last point
    result = smoothed;
  }

  return result;
}