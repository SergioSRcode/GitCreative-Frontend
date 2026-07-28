// Single captured point along a stroke
export type StrokePoint = {
  x: number,  // canvas pixel x
  y: number,  // canvas pixel y
  pressure: number,  // 0.0 -> 1.0
  timeStamp: number,  // ms since page load
  isPen: boolean
};

// A complete stroke from pointerdown to pointer up
export type Stroke = {
  id: string,
  points: StrokePoint[],
  color: [number, number, number],  // RGB, each 0.0 -> 1.0
  size: number,  // brush diameter in px
  opacity: number,  // 0.0 -> 1.0
}

