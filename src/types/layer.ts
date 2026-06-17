export type Layer = {
  id: string,
  name: string,
  visible: boolean,
  opacity: number,
  texture: WebGLTexture,
  framebuffer: WebGLFramebuffer,
};

