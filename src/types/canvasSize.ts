export type CanvasSizePreset = {
  name: string,
  width: number,
  height: number,
};

// width/height of 0 is a sentinel meaning "resolve to the current screen size
// at the moment of creation" — never stored as literally 0 in a real document
export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { name: 'Screen (current device)', width: 0, height: 0 },
  { name: 'A4 (2480 × 3508)', width: 2480, height: 3508 },
  { name: 'A5 (1748 × 2480)', width: 1748, height: 2480 },
  { name: 'Full HD (1920 × 1080)', width: 1920, height: 1080 },
  { name: 'Square (2048 × 2048)', width: 2048, height: 2048 },
];

export function resolveScreenSize(): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  
  return {
    width:  Math.round(window.innerWidth  * dpr),
    height: Math.round(window.innerHeight * dpr),
  };
}