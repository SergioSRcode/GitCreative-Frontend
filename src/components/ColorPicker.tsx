import { useEffect, useRef } from "react";
import type { HSVColor } from "../types/color";
import { pureHue, rgbToCss } from "../utils/color";

type Props = {
  color: HSVColor,
  onChange: (color: HSVColor) => void,
};

export function ColorPicker({ color, onChange }: Props) {
  const svRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const draggingSV = useRef(false);
  const draggingHue = useRef(false);

  function drawSVSquare(canvas: HTMLCanvasElement, hue: number) {
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;

    // Horizontal gradient from white (left) to pure hue (right)
    const hueRgb = pureHue(hue);
    const hGrad = ctx.createLinearGradient(0, 0, width, 0);
    hGrad.addColorStop(0, '#ffffff');
    hGrad.addColorStop(1, rgbToCss(hueRgb));
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, width, height);

    // Vertical gradient from transparent (top) to black (bottom)
    // is drawn on top of the horizontal gradient
    const vGrad = ctx.createLinearGradient(0, 0, 0, height);
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // draws hue bar
  function drawHueBar(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    // Six key hue stops across 0°–360°
    const stops = [0, 60, 120, 180, 240, 300, 360];
    stops.forEach((h, i) => {
      grad.addColorStop(i / (stops.length - 1), `hsl(${h}, 100%, 50%)`);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // redraw SV square whenever hue changes
  useEffect(() => {
    if (svRef.current) drawSVSquare(svRef.current, color.h);
  }, [color.h]);

  // draw hue bar once on mount - never changes
  useEffect(() => {
    if (hueRef.current) drawHueBar(hueRef.current);
  }, []);

  function pickSV(e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) {
    const canvas = svRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    onChange({ h: color.h, s: x, v: 1 - y });
  }

  function pickHue(e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) {
    const canvas = hueRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    onChange({ h: x * 360, s: color.s, v: color.v });
  }

  // pointer capture keeps tracking the drag even when the curser leaves the canvas element (same logic as with stroke drawing)
  function onSVDown(e: React.PointerEvent<HTMLCanvasElement>) {
    svRef.current!.setPointerCapture(e.pointerId);
    draggingSV.current = true;
    pickSV(e);
  }

  function onHueDown(e: React.PointerEvent<HTMLCanvasElement>) {
    hueRef.current!.setPointerCapture(e.pointerId);
    draggingHue.current = true;
    pickHue(e);
  }

  function onSVMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (draggingSV.current) pickSV(e);
  }

  function onHueMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (draggingHue.current) pickHue(e);
  }

  function onUp() {
    draggingSV.current = false;
    draggingHue.current = false;
  }

  // Thumb position on the SV square
  // tracks the current S and V values
  const thumbX = `${color.s * 100}%`;
  const thumbY = `${(1 - color.v) * 100}%`;

   return (
    <div style={{ width: 220, userSelect: 'none' }}>

      {/* SV Square */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <canvas
          ref={svRef}
          width={220}
          height={220}
          style={{ display: 'block', width: '100%', borderRadius: 6, cursor: 'crosshair' }}
          onPointerDown={onSVDown}
          onPointerMove={onSVMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
        {/* Circular thumb showing current SV position */}
        <div style={{
          position: 'absolute',
          left: thumbX,
          top: thumbY,
          width: 12,
          height: 12,
          borderRadius: '50%',
          border: '2px solid white',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Hue Bar */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <canvas
          ref={hueRef}
          width={220}
          height={14}
          style={{ display: 'block', width: '100%', borderRadius: 4, cursor: 'pointer' }}
          onPointerDown={onHueDown}
          onPointerMove={onHueMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
        {/* Hue thumb */}
        <div style={{
          position: 'absolute',
          left: `${(color.h / 360) * 100}%`,
          top: '50%',
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '2px solid white',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          background: `hsl(${color.h}, 100%, 50%)`,
        }} />
      </div>
    </div>
  )
}