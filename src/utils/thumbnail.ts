import { deserialiseDocumentCompressed } from './document';
import { flipVertically } from './export';
import { fetchCurrentState } from '../api/projects';
// import { BlendMode } from '../types/layer';
import { blendModeToComposite } from './export';

const THUMB_SIZE = { w: 320, h: 180 };

// Fetches a project's current state and renders a small preview image,
// entirely via the 2D canvas API — no WebGL context needed, since this
// only needs to rasterize already-decoded pixel data, not do any live rendering
export async function fetchProjectThumbnail(
  projectId: string,
  branchId: string
): Promise<string> {
  const buffer = await fetchCurrentState(projectId, branchId);
  const doc    = await deserialiseDocumentCompressed(buffer);

  const offscreen = document.createElement('canvas');
  offscreen.width  = THUMB_SIZE.w;
  offscreen.height = THUMB_SIZE.h;
  const ctx = offscreen.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, THUMB_SIZE.w, THUMB_SIZE.h);

  // Composites every visible layer, bottom to top — a simple approximation
  // of the real WebGL compositor (no blend modes), good enough for a thumbnail
  for (const layerMeta of doc.metadata.layers) {
    if (!layerMeta.visible) continue;
    const pixels = doc.layerPixels.get(layerMeta.id);
    if (!pixels) continue;

    const flipped = flipVertically(pixels, doc.metadata.width, doc.metadata.height);

    const layerCanvas = document.createElement('canvas');
    layerCanvas.width  = doc.metadata.width;
    layerCanvas.height = doc.metadata.height;
    const layerCtx = layerCanvas.getContext('2d')!;
    const imageData = new ImageData(
      new Uint8ClampedArray(flipped), doc.metadata.width, doc.metadata.height
    );
    layerCtx.putImageData(imageData, 0, 0);

    ctx.globalCompositeOperation = blendModeToComposite[layerMeta.blendMode] ?? 'source-over';
    ctx.globalAlpha = layerMeta.opacity;
    ctx.drawImage(layerCanvas, 0, 0, THUMB_SIZE.w, THUMB_SIZE.h);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;

  return offscreen.toDataURL('image/jpeg', 0.8); // JPEG for smaller size, quality doesn't need to be high for a thumbnail
}