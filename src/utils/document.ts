import type { DocumentLayerMeta, DocumentMetadata } from "../types/document";
import type { Layer } from "../types/layer";

const MAGIC = new Uint8Array([0x47, 0x49, 0x54, 0x43]);  // "GITC"
const VERSION = 1;

export function serialiseDocument(
  metadata: Omit<DocumentMetadata, 'version' | 'layers'> & { name: string },
  layers: Layer[],
  gl: WebGL2RenderingContext
): Blob {
  const canvas = gl.canvas as HTMLCanvasElement;

  // builds JSON metadata
  const layerMetas: DocumentLayerMeta[] = layers.map((layer, index) => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    index,
  }));

  const doc: DocumentMetadata = {
    version: VERSION,
    name: metadata.name,
    width: canvas.width,
    height: canvas.height,
    activeLayerId: metadata.activeLayerId,
    layers: layerMetas,
  };

  const jsonStr = JSON.stringify(doc);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  // reads pixel data for each layer
  const layerPixels: Uint8Array[] = layers.map(layer => {
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return pixels;
  });

  // calculates total buffer size
  const headerSize = 4 + 4 + 4 + jsonBytes.byteLength + 4;  // magic + version + jsonLen + json + layerCount
  const layerDataSize = layerPixels.reduce((sum, p) => sum + 4 + 4 + p.byteLength, 0);  // index + pixelLen + pixels per layer
  const totalSize = headerSize + layerDataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let offset = 0;

  // magic num
  bytes.set(MAGIC, offset);
  offset += 4;

  // version
  view.setUint32(offset, VERSION, true);  // ture = little-endian
  offset += 4;

  // JSON length + JSON bytes
  view.setUint32(offset, jsonBytes.byteLength, true);
  offset += 4;
  bytes.set(jsonBytes, offset);
  offset += jsonBytes.byteLength;

  // layer count
  view.setUint32(offset, layers.length, true);
  offset += 4;

  // layer pixel data
  layerPixels.forEach((pixels, index) => {
    view.setUint32(offset, index, true);
    offset += 4;

    view.setUint32(offset, pixels.byteLength, true);
    offset += 4;

    bytes.set(pixels, offset);
    offset += pixels.byteLength;
  });

  return new Blob([buffer], { type: 'application/octet-stream' });
}

/*
NOTES:

- DataView allows writing multi-byte integers (setUint32) at specific byte offsets with explicit endiannes control
- Uint8Array allows to set raw byte arrays (i.e. JSON and pixel data) at specific offsets

Both operade on the same underlying ArrayBuffer

The true boolean parameter (little-endian) passed to setUint32 specifies little-endian byte order

TextEncoder: converts JSON string to a Uint8Array of UTF-8 bytes. => browser standard API for string-to-bytes conversion.
*/