export type BrushType = 'pencil' | 'ink' | 'eraser' | 'airbrush';
export type Tool = BrushType | 'fill';
export type AirbrushVariant = 'soft' | 'medium' | 'hard';

export type AirbrushVariantOption = {
  value: AirbrushVariant,
  label: string,
}

export const AIRBRUSH_VARIANTS: AirbrushVariantOption[] = [
  { value: 'soft',   label: 'Soft'   },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard'   },
];

export type Brush = {
  type: BrushType,
  size: number,   // base diameter in px
  opacity: number,  // 0.0 -> 1.0
  color: [number, number, number],
}