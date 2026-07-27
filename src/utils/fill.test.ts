import { floodFill } from './fill'

describe('floodFill', () => {
  it('fills a fully transparent region and stops at an opaque boundary', () => {
    // 3x3 canvas: transparent center surrounded by a black border
    const width = 3, height = 3
    const pixels = new Uint8Array(width * height * 4)

    // Fill everything black and opaque first
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 0; pixels[i+1] = 0; pixels[i+2] = 0; pixels[i+3] = 255
    }
    // Make the center pixel (1,1) transparent
    const centerIndex = (1 * width + 1) * 4
    pixels[centerIndex] = 0; pixels[centerIndex+1] = 0
    pixels[centerIndex+2] = 0; pixels[centerIndex+3] = 0

    const filled = floodFill(pixels, width, height, 1, 1, [255, 0, 0, 255], 0)

    expect(filled).toBe(true)
    // Center should now be red
    expect(pixels[centerIndex]).toBe(255)
    expect(pixels[centerIndex + 3]).toBe(255)
    // A corner (still part of the black border) should be untouched
    const cornerIndex = 0
    expect(pixels[cornerIndex]).toBe(0)
  })

  it('returns false and makes no changes when target already matches fill color', () => {
    const width = 2, height = 2
    const pixels = new Uint8Array(width * height * 4)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255; pixels[i+1] = 0; pixels[i+2] = 0; pixels[i+3] = 255
    }

    const filled = floodFill(pixels, width, height, 0, 0, [255, 0, 0, 255], 0)
    expect(filled).toBe(false)
  })

  it('respects tolerance — a slightly different shade is included when tolerance allows it', () => {
    const width = 2, height = 1
    const pixels = new Uint8Array(width * height * 4)
    // pixel 0: (100, 100, 100, 255) — pixel 1: (110, 100, 100, 255), slightly different red channel
    pixels.set([100, 100, 100, 255, 110, 100, 100, 255])

    // With zero tolerance, the fill should NOT spread to the slightly different neighbor
    // (only pixel 0 changes)
    const strictBuffer = new Uint8Array(pixels)
    floodFill(strictBuffer, width, height, 0, 0, [0,0,0,255], 0)
    expect(strictBuffer[4]).toBe(110) // pixel 1 unchanged

    const looseBuffer = new Uint8Array(pixels)
    floodFill(looseBuffer, width, height, 0, 0, [0,0,0,255], 15)
    expect(looseBuffer[4]).toBe(0) // pixel 1 WAS filled — tolerance included it
  })
})