export type BrushType = 'pencil' | 'ink' | 'eraser';

export type Brush = {
  type: BrushType,
  size: number,   // base diameter in px
  opacity: number,  // 0.0 -> 1.0
  color: [number, number, number],
}