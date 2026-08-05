type RGBA = [number, number, number, number];

// Compares two RGBA colors (0-255 each) against a tolerance threshold (0-255).
// Uses simple per-channel max difference rather than full color distance —
// fast and predictable for a fill tool.
function colorsMatch(a: RGBA, b: RGBA, tolerance: number): boolean {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance &&
    Math.abs(a[3] - b[3]) <= tolerance
  );
}

function getPixel(pixels: Uint8Array, x: number, y: number, width: number): RGBA {
  const i = (y * width + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

function setPixel(pixels: Uint8Array, x: number, y: number, width: number, color: RGBA) {
  const i = (y * width + x) * 4;

  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3];
}

export function floodFill(
  pixels: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor: RGBA,
  tolerance: number,
  selectionMask: Uint8Array | null = null  // optional
): boolean {
  const targetColor = getPixel(pixels, startX, startY, width);

  if (colorsMatch(targetColor, fillColor, 0)) return false;

  const visited = new Uint8Array(width * height);

  const queue: number[] = [startY * width + startX];
  visited[startY * width + startX] = 1;

  let filledAny = false;

  while (queue.length > 0) {
    const index = queue.pop()!;
    const x = index % width;
    const y = Math.floor(index / width);

    // Skips this pixel entirely if it's outside an active selection
    if (selectionMask) {
      const maskAlpha = selectionMask[index * 4 + 3];
      if (maskAlpha === 0) continue;
    }

    const current = getPixel(pixels, x, y, width);
    if (!colorsMatch(current, targetColor, tolerance)) continue;

    setPixel(pixels, x, y, width, fillColor);
    filledAny = true;

    const neighbours = [
      [x - 1, y], [x + 1, y],
      [x, y - 1], [x, y + 1]
    ];

    for (const [nx, ny] of neighbours) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIndex = ny * width + nx;
      if (visited[nIndex]) continue;
      visited[nIndex] = 1;
      queue.push(nIndex);
    }
  }

  return filledAny;
}