export type BlendMode = 'normal' | 'multiply' | 'overlay';

export type BlendModeOption = {
  value: BlendMode,
  label: string,
};

export const BLEND_MODES: BlendModeOption[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
];

export type Layer = {
  id: string,
  name: string,
  visible: boolean,
  opacity: number,
  blendMode: BlendMode,
  texture: WebGLTexture,
  framebuffer: WebGLFramebuffer,
};
