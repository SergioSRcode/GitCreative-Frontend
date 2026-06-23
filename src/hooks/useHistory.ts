import { useState, useRef } from "react";
import type { Layer } from "../types/layer";

// captures the full pixel data of each layer at one point in time
export type Snapshot = {
  layers: {
    id: string,
    pixels: Uint8Array,
    width: number,
    height: number,
  }[]
};

const MAX_HISTORY = 50;  // max undo steps

export function useHistory() {
  // useRef over useState:
  // both stacks live in refs => they are never used for rendering, thus making useState unnecessary
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);

  // states only pupose is to trigger re-renders (for undo/redo to be in sync)
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick((t: number) => t + 1);

  function captureSnapshot(
    gl: WebGL2RenderingContext,
    layers: Layer[]
  ): Snapshot {
    const canvas = gl.canvas as HTMLCanvasElement;
    return {
      layers: layers.map(layer => {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);

        // binds layers framebuffer so readPixels can read from texture
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return { id: layer.id, pixels, width: canvas.width, height: canvas.height };
      }),
    }
  }

  // restores snapshot into layer textures
  function restoreSnapshot(
    gl: WebGL2RenderingContext,
    layers: Layer[],
    snapshot: Snapshot
  ) {
    for (const saved of snapshot.layers) {
      const layer = layers.find(l => l.id === saved.id);
      if (!layer) continue;

      // texSubImage2D writes into textures directly => no framebuffer needed.
      gl.bindTexture(gl.TEXTURE_2D, layer.texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,  // mip level
        0, 0,  // x, y offset => 0, 0 = overwrite from the top-left
        saved.width,
        saved.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        saved.pixels,
      );
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  // pushes new snapshot onto the undo stack
  // is called after each completed stroke
  function pushSnapshot(gl: WebGL2RenderingContext, layers: Layer[]) {
    const snapshot = captureSnapshot(gl, layers);

    undoStack.current.push(snapshot);

    // Trims to keep memory usage bounded
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift(); // removes oldest entry

    // resets redo because last move was a stroke (doesn't reset after 'undo')
    redoStack.current = [];

    forceUpdate();  // triggers re-render
  }

  function undo(gl: WebGL2RenderingContext, layers: Layer[]): boolean {
    if (undoStack.current.length <= 1) return false;

    // saves current state to redo stack before restoring prev capture
    const current = captureSnapshot(gl, layers);
    redoStack.current.push(current);
    undoStack.current.pop();

    const previous = undoStack.current[undoStack.current.length - 1];
    restoreSnapshot(gl, layers, previous);

    forceUpdate();  // triggers re-render
    return true;
  }

  function redo(gl: WebGL2RenderingContext, layers: Layer[]): boolean {
    if (redoStack.current.length === 0) return false;

    const next = redoStack.current.pop()!;
    const current = captureSnapshot(gl, layers);
    // saves current state to undo stack before restoring capture
    undoStack.current.push(current);
    
    restoreSnapshot(gl, layers, next);

    forceUpdate(); // triggers re-render
    return true;
  }

  function canUndo() { 
    return undoStack.current.length > 1;
  }

  function canRedo() {
    return redoStack.current.length > 0;
  }

  return { pushSnapshot, undo, redo, canUndo, canRedo };
}