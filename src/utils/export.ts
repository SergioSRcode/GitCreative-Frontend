import type { Layer } from "../types/layer";
import type { BlendMode } from "../types/layer";

export const blendModeToComposite: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: "multiply",
  overlay: "overlay",
}

export type ExportFormat = 'png' | 'jpeg';

export async function exportCanvas(
  gl: WebGL2RenderingContext,
  layers: Layer[],
  width: number,
  height: number,
  format: ExportFormat = 'png',
  filename: string = 'painting'
): Promise<void> {
  // creates temparay offscreen 2D canvas of the same size as the WebGL canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d')!;

  // fills with white (relevant for JPEG)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // reads each visible pixel from the frambuffer and puts it onto the 2D canvas in order (bottom layer first)
  const pixelBuffer = new Uint8Array(width * height * 4);

  for (const layer of layers) {
    if (!layer.visible) continue;

    // binds layer's framebuffer, allowing gl.readPixels to read its texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // ImageData expects pixels from top-row-first (gl.pixelReads returns buttom-row-first) => flip it
    const flipped = flipVertically(pixelBuffer, width, height);
    // wraps pixel data in an ImageData object, so the 2D canvas can read it
    const imageData = new ImageData(new Uint8ClampedArray(flipped), width, height);

    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = width;
    layerCanvas.height = height;
    layerCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

        // Apply this layer's actual blend mode, not just opacity
    ctx.globalCompositeOperation = blendModeToComposite[layer.blendMode] ?? 'source-over';
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(layerCanvas, 0, 0);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpeg' ? 0.92 : undefined;

  offscreen.toBlob(blob => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `${filename}.${format}`;
    a.click();

    // cleans up the object URL after downloading
    URL.revokeObjectURL(url);
  }, mimeType, quality);
}

export function flipVertically(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowSize = width * 4;  // 4 bytes per pixel (RGBA)
  const flipped = new Uint8Array(pixels.length);

  for (let y = 0; y < height; y++) {
    const srcRow  = (height - 1 - y) * rowSize;
    const destRow = y * rowSize;
    flipped.set(pixels.subarray(srcRow, srcRow + rowSize), destRow);
  }

  return flipped;
}