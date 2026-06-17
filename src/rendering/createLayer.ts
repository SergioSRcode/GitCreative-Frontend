import type { Layer } from '../types/layer';

export function createLayer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  name: string,
): Layer {
  // creates an empty texture to the canvas
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,  // mip level
    gl.RGBA,  // internal format
    width,
    height,
    0,  // border, should be 0
    gl.RGBA,  // source format
    gl.UNSIGNED_BYTE,  // source type
    null  // start out transparent = no initial pixel data
  );

  // Texture filtering - NEAREST avoids blurring crisp brush edges
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Creates a framebuffer and attaches the texture to it
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  // attaches texture to framebuffer's color output slot 
  // => makes sure that anything drawn while this framebuffer is bound writes into that texture's pixels
  // => not the screen itself
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,  // slot 0 - where color output goes
    gl.TEXTURE_2D,
    texture,
    0  // mip level
  );

  // quick check if framebuffer is valid
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Framebuffer incomplete: ${status}`);

  // clearing frambuffer to be fully transparent = layer starts empty
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Unbind - back to drawing on the screen by default
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    id: crypto.randomUUID(),
    name,
    visible: true,
    opacity: 1.0,
    texture,
    framebuffer,
  };
}