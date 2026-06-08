import { useEffect, useRef } from "react";

type PointerPoint = {
  x: number,
  y: number,
  pressure: number,
  timeStamp: number,
};

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const isDrawing = useRef(false); // useRef avoids rerenders of the Canvas component

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

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): PointerPoint {
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

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // avoids cutting off the event when the pointer leaves the canvas while drawing
    canvasRef.current!.setPointerCapture(e.pointerId);
    isDrawing.current = true;

    const point = getPoint(e);
    console.log('Stroke start: ', point);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    // !isDrawing.current makes sure the pointer isn't drawing while hovering
    if (!isDrawing.current) return; 

    const point = getPoint(e);
    console.log('Stroke point: ', point);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;

    isDrawing.current = false;

    const point = getPoint(e);
    console.log('Stroke end: ', point);
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

    // resizes canvas and clears it to a white background
    resizeCanvas(canvas, gl);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // resizes with each window change
    function handleResize() {
      resizeCanvas(canvas!, gl!);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
    }

    window.addEventListener('resize', handleResize);

    // listener cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    }
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
