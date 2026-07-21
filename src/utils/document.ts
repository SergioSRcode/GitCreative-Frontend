import type { DocumentLayerMeta, DocumentMetadata } from "../types/document";
import type { Layer } from "../types/layer";

const MAGIC = new Uint8Array([0x47, 0x49, 0x54, 0x43]);  // "GITC"
const VERSION = 1;

export function serialiseDocument(
  metadata: { name: string; activeLayerId: string | null },
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
  gl.finish();

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

export async function serialiseDocumentCompressed(
  metadata: { name: string; activeLayerId: string | null },
  layers: Layer[],
  gl: WebGL2RenderingContext
): Promise<Blob> {
  const raw = serialiseDocument(metadata, layers, gl);
  const rawBuffer = await raw.arrayBuffer();

  // Compresses using browser's built-in gzip
  const stream = new CompressionStream('gzip');
  const writer  = stream.writable.getWriter();
  writer.write(rawBuffer);
  writer.close();

  const compressed = await new Response(stream.readable).arrayBuffer();

  return new Blob([compressed], { type: 'application/octet-stream' });
}

export type DeserialisedDocument = {
  metadata: DocumentMetadata,
  layerPixels: Map<string, Uint8Array>,  // keyed by layer id
};

// parses a binary .gitcreative file back into metadata + pixel data
export function deserialiseDocument(buffer: ArrayBuffer): DeserialisedDocument {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  // verifies magic num
  const magic = bytes.slice(0, 4);
  if (magic[0] !== 0x47 || magic[1] !== 0x49 || magic[2] !== 0x54 || magic[3] !== 0x43) {
    throw new Error('Invalid GitCreative file - magic number mismatch');
  }
  offset += 4;

  // version check
  const version = view.getUint32(offset, true);
  offset += 4;
  if (version !== VERSION) {
    throw new Error(`Unsupported document version: ${version}. Expected ${VERSION}`);
  }

  // json metadata
  const jsonLength = view.getUint32(offset, true);
  offset += 4;
  const jsonBytes = bytes.slice(offset, offset + jsonLength);
  const jsonStr = new TextDecoder().decode(jsonBytes);
  const metadata = JSON.parse(jsonStr) as DocumentMetadata;
  offset += jsonLength;

  // layer pixel data
  const layerCount = view.getUint32(offset, true);
  offset += 4;

  const layerPixels = new Map<string, Uint8Array>();

  for (let i = 0; i < layerCount; i++) {
    const layerIndex = view.getUint32(offset, true);
    offset += 4;

    const pixelLength = view.getUint32(offset, true);
    offset += 4;

    const pixels = bytes.slice(offset, offset + pixelLength);
    offset += pixelLength;

    // maps by layer id using the idx to look up the corresponding meta data
    const layerMeta = metadata.layers.find(l => l.index === layerIndex);
    if (layerMeta) {
      layerPixels.set(layerMeta.id, pixels);
    }
  }

  return { metadata, layerPixels };
}

export async function deserialiseDocumentCompressed(
  buffer: ArrayBuffer
): Promise<DeserialisedDocument> {
  // Checks if data starts with gzip magic bytes (0x1f 0x8b)
  const header = new Uint8Array(buffer, 0, 2)
  const isGzip = header[0] === 0x1f && header[1] === 0x8b

  if (!isGzip) {
    // Legacy uncompressed snapshot — parses directly
    return deserialiseDocument(buffer)
  }

  const stream      = new DecompressionStream('gzip');
  const writer      = stream.writable.getWriter();
  writer.write(buffer);
  writer.close();

  const decompressed = await new Response(stream.readable).arrayBuffer();

  return deserialiseDocument(decompressed);
}

/*
NOTES to serialisation:

- DataView allows writing multi-byte integers (setUint32) at specific byte offsets with explicit endiannes control
- Uint8Array allows to set raw byte arrays (i.e. JSON and pixel data) at specific offsets

Both operade on the same underlying ArrayBuffer

The true boolean parameter (little-endian) passed to setUint32 specifies little-endian byte order

TextEncoder: converts JSON string to a Uint8Array of UTF-8 bytes. => browser standard API for string-to-bytes conversion.
*/