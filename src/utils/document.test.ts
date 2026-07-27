import { serialiseDocument, deserialiseDocument } from './document'
import type { Layer } from '../types/layer'

function createFakeGLForSerialize(width: number, height: number) {
  return {
    canvas: { width, height },
    bindFramebuffer: () => {},
    finish: () => {},
    readPixels: (
      _x: number, _y: number, _w: number, _h: number,
      _format: number, _type: number, outBuffer: Uint8Array
    ) => {
      // Fill with a recognizable pattern so we can verify round-trip content
      for (let i = 0; i < outBuffer.length; i++) outBuffer[i] = i % 256
    },
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    FRAMEBUFFER: 36160,
  } as unknown as WebGL2RenderingContext
}

function makeFakeLayer(id: string, name: string): Layer {
  return {
    id, name, visible: true, opacity: 1, blendMode: 'normal',
    texture: {} as WebGLTexture,
    framebuffer: {} as WebGLFramebuffer,
  }
}

describe('document serialization', () => {
  it('round-trips metadata and pixel data through serialize and deserialize', async () => {
    const gl = createFakeGLForSerialize(4, 4)
    const layers = [makeFakeLayer('layer1', 'Background')]

    const blob = serialiseDocument(
      { name: 'Test Project', activeLayerId: 'layer1' },
      layers,
      gl
    )

    const buffer = await blob.arrayBuffer()
    const doc     = deserialiseDocument(buffer)

    expect(doc.metadata.name).toBe('Test Project')
    expect(doc.metadata.width).toBe(4)
    expect(doc.metadata.height).toBe(4)
    expect(doc.metadata.layers.length).toBe(1)
    expect(doc.metadata.layers[0].name).toBe('Background')

    const pixels = doc.layerPixels.get('layer1')
    expect(pixels).toBeDefined()
    expect(pixels!.length).toBe(4 * 4 * 4) // width * height * 4 channels
    expect(pixels![0]).toBe(0)   // matches the fill pattern (i % 256)
    expect(pixels![255 % (4*4*4)]).toBeDefined()
  })

  it('throws a clear error when magic bytes are invalid', () => {
    const garbage = new ArrayBuffer(20)
    expect(() => deserialiseDocument(garbage)).toThrow('magic number mismatch')
  })
})