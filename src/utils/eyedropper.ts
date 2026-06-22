import type { RGBColor } from "../types/color";
import type { Layer } from "../types/layer";

export function sampleColorFromLayer(
  gl: WebGL2RenderingContext,
  layer: Layer,
  canvasX: number,
  canvasY: number,
  canvasheight: number
): RGBColor {
  // binds layer's framebuffer so gl.readPixels reads from that texture
  gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);

  const pixel = new Uint8Array(4);

  // Y must be flipped from canvas pixel coordinates, because
  // gl.readPixels uses clip space coordinates
  const flippedY = canvasheight - canvasY;

  // 1, 1 means => it reads a single 1x1 pixel
  gl.readPixels(Math.floor(canvasX), Math.floor(flippedY), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

  // unbinding the layer's framebuffer - back to screen rendering
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    r: pixel[0] / 255,
    g: pixel[1] / 255,
    b: pixel[2] / 255,
  };
}