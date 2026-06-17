import { useEffect, useRef } from "react";
import type { StrokePoint, Stroke } from "../types/stroke";
import type { Layer } from "../types/layer";
import { resample, smooth } from "../utils/stroke";
import { StrokeRenderer } from "../rendering/StrokeRenderer";
import { Compositor } from "../rendering/Compositor";
import { createLayer } from "../rendering/createLayer";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const rendererRef = useRef<StrokeRenderer | null>(null);
  const compositorRef = useRef<Compositor | null>(null);
  const layersRef = useRef<Layer[]>([]);
  const isDrawing = useRef(false); // useRef avoids rerenders of the Canvas component
  const currentPoints = useRef<StrokePoint[]>([]);

  // resizes canvas to actual display size of the device
  function resizeCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      // gl.viewport(0, 0, displayWidth, displayHeight);
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

  // composites all layers onto the visible screen
  function compositeToScreen() {
    const gl = glRef.current!;
    const canvas = canvasRef.current!;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)  // null = the screen
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1, 1, 1, 1);  // white page background
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enables blending so transparent layer areas show what's beneath
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      compositorRef.current!.drawLayer(layer);
    }
  }

  // render the in-progress stroke into the active layer's texture
  function renderCurrentStrokeToLayer() {
    const gl = glRef.current!;
    const renderer = rendererRef.current!;
    const activeLayer = layersRef.current[0];  // single layer for now

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

    renderer.render(stroke, activeLayer.framebuffer, gl.canvas.width, gl.canvas.height);
    compositeToScreen();
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
    renderCurrentStrokeToLayer();

    // keeps last point as the new segment start
    currentPoints.current = currentPoints.current.slice(-1); 
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;

    isDrawing.current = false;
    currentPoints.current.push(getPoint(e));
    renderCurrentStrokeToLayer();
    currentPoints.current = [];
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported by the browser');
      return;
    }

    glRef.current = gl;
    resizeCanvas(canvas);

    rendererRef.current = new StrokeRenderer(gl);
    compositorRef.current = new Compositor(gl);
    layersRef.current = [createLayer(gl, canvas.width, canvas.height, 'Layer 1')];

    compositeToScreen();

    // resizes with each window change
    function handleResize() {
      resizeCanvas(canvas);
      compositeToScreen();
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
