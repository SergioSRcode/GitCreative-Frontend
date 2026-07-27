import { hsvToRgb, rgbToHsv } from './color'

describe('color conversion', () => {
  it('converts pure red correctly', () => {
    const rgb = hsvToRgb({ h: 0, s: 1, v: 1 })
    expect(rgb.r).toBeCloseTo(1)
    expect(rgb.g).toBeCloseTo(0)
    expect(rgb.b).toBeCloseTo(0)
  })

  it('converts pure white correctly', () => {
    const rgb = hsvToRgb({ h: 0, s: 0, v: 1 })
    expect(rgb.r).toBeCloseTo(1)
    expect(rgb.g).toBeCloseTo(1)
    expect(rgb.b).toBeCloseTo(1)
  })

  it('converts pure black correctly regardless of hue', () => {
    const rgb = hsvToRgb({ h: 200, s: 0.5, v: 0 })
    expect(rgb.r).toBeCloseTo(0)
    expect(rgb.g).toBeCloseTo(0)
    expect(rgb.b).toBeCloseTo(0)
  })

  it('round-trips RGB -> HSV -> RGB without meaningful drift', () => {
    const original = { r: 0.6, g: 0.3, b: 0.8 }
    const hsv       = rgbToHsv(original)
    const roundTripped = hsvToRgb(hsv)

    expect(roundTripped.r).toBeCloseTo(original.r, 5)
    expect(roundTripped.g).toBeCloseTo(original.g, 5)
    expect(roundTripped.b).toBeCloseTo(original.b, 5)
  })
})