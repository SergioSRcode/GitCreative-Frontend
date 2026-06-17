import { useEffect, useRef, useState } from "react";
import type { StrokePoint, Stroke } from "../types/stroke";
import type { Layer } from "../types/layer";
import type { Brush, BrushType } from "../types/brush";
import { resample, smooth } from "../utils/stroke";
// import { StrokeRenderer } from "../rendering/StrokeRenderer";
import { BrushRenderer } from "../rendering/BrushRenderer";
import { Compositor } from "../rendering/Compositor";
import { createLayer } from "../rendering/createLayer";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const rendererRef = useRef<BrushRenderer | null>(null);
  const compositorRef = useRef<Compositor | null>(null);
  const layersRef = useRef<Layer[]>([]);
  const isDrawing = useRef(false); // useRef avoids rerenders of the Canvas component
  const currentPoints = useRef<StrokePoint[]>([]);

  const [brushType, setBrushType] = useState<BrushType>('ink');

  const brush: Brush = {
    type: brushType,
    size: brushType === 'pencil' ? 18 : brushType === 'eraser' ? 40 : 10,
    opacity: 1.0,
    color: [0.0, 0.0, 0.0],
  };

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

    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

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

    // Spacing scales with brush size — denser dabs for smaller brushes
    const spacing = Math.max(brush.size * 0.15, 1);
    const resampled = resample(currentPoints.current, spacing);
    const smoothed = smooth(resampled, 1);

    const stroke: Stroke = {
      id: 'current',
      points: smoothed,
      color: brush.color,
      size: brush.size,
      opacity: brush.opacity,
    }

    renderer.render(stroke, brush, activeLayer.framebuffer, gl.canvas.width, gl.canvas.height);
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

    rendererRef.current = new BrushRenderer(gl);
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
    <>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1, display: 'flex', gap: 8 }}>
        <button onClick={() => setBrushType('pencil')}>Pencil</button>
        <button onClick={() => setBrushType('ink')}>Ink</button>
        <button onClick={() => setBrushType('eraser')}>Eraser</button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100vw', height: '100vh', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </>
  )
}
