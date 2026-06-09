import { useEffect, useRef } from "react";
import type { StrokePoint, Stroke } from "../types/stroke";
import { resample, smooth } from "../utils/stroke";
import { StrokeRenderer } from "../rendering/StrokeRenderer";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const rendererRef = useRef<StrokeRenderer | null>(null);
  const isDrawing = useRef(false); // useRef avoids rerenders of the Canvas component
  const currentPoints = useRef<StrokePoint[]>([]);

  // resizes canvas to actual display size of the device
  function resizeCanvas(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, displayWidth, displayHeight);
    }
  }

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
      // Mice report 0.5, styluses report 0–1
      pressure: e.pressure > 0 ? e.pressure : 0.5,
      timeStamp: e.timeStamp,
    }
  }

  function renderCurrentStroke() {
    const gl = glRef.current!;
    const renderer = rendererRef.current!;

    // clear and redraw every frame
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (currentPoints.current.length < 2) return;

    const resampled = resample(currentPoints.current, 2);
    const smoothed = smooth(resampled, 2);

    const stroke: Stroke = {
      id: 'current',
      points: smoothed,
      color: [0.0, 0.0, 0.0],  // black
      size: 12,
      opacity: 1.0,
    }

    renderer.render(stroke);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // avoids cutting off the event when the pointer leaves the canvas while drawing
    canvasRef.current!.setPointerCapture(e.pointerId);
    isDrawing.current = true;

    currentPoints.current = [getPoint(e)];
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    // conditional makes sure the pointer isn't drawing while hovering
    if (!isDrawing.current) return; 

    currentPoints.current.push(getPoint(e));
    renderCurrentStroke();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;

    isDrawing.current = false;
    currentPoints.current.push(getPoint(e));
    renderCurrentStroke();
    currentPoints.current = [];
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported by the browser');
      return;
    }

    glRef.current = gl;
    rendererRef.current = new StrokeRenderer(gl);

    // resizes canvas and clears it to a white background
    resizeCanvas(canvas, gl);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enables alpha blending so opacity works correctly
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // resizes with each window change
    function handleResize() {
      resizeCanvas(canvas!, gl!);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
    }

    window.addEventListener('resize', handleResize);

    // listener cleanup on unmount
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas 
      ref={canvasRef}
      style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none'}}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      // avoids edge cases where the pointer might exit the canvas without triggering onPointerUp
      onPointerLeave={onPointerUp}
    />
  )
}
