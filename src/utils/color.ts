import type { HSVColor, RGBColor } from "../types/color";

export function hsvToRgb({ h, s, v }: HSVColor): RGBColor {
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i) {
    case 0: return { r: v, g: t, b: p }
    case 1: return { r: q, g: v, b: p }
    case 2: return { r: p, g: v, b: t }
    case 3: return { r: p, g: q, b: v }
    case 4: return { r: t, g: p, b: v }
    case 5: return { r: v, g: p, b: q }
    default: return { r: 0, g: 0, b: 0 }
  }
}

export function rgbToHsv({ r, g, b }: RGBColor): HSVColor {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  const v = max; 
  const s = max === 0 ? 0 : delta / max;

  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * (((b - r) / delta) + 2);
    } else {
      h = 60 * (((r - g) / delta) + 4);
    }
  }

  if (h < 0) h += 360;

  return { h, s, v };
}

// converts RGB to a CSS hex string => e.g. "#ff3300"
export function rgbToHex({ r, g, b }: RGBColor): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// parses CSS hex string to an RGB object
export function hexToRgb(hex: string): RGBColor {
  const clean = hex.replace('#', '');

  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

// converts RGB to a CSS rgb string for use in canvas gradients
export function rgbToCss({ r, g, b }: RGBColor): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

// gets pure hue color at full saturation and value;
// used to draw the SV square
export function pureHue(h: number): RGBColor {
  return hsvToRgb({ h, s: 1, v: 1 });
}