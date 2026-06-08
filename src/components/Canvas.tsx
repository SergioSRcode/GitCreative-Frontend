import { useEffect, useRef } from "react";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported by the browser');
      return;
    }

    glRef.current = gl;

    // Clears cavas to a white background
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    console.log('WebGL2 context initialized');
  }, []);

  return (
    <canvas 
      ref={canvasRef}
      style={{ display: 'block', width: '100vw', height: '100vh'}}
    />
  )
}
