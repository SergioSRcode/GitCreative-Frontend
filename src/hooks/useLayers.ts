import { useState, useRef } from "react";
import type { Layer, BlendMode } from "../types/layer";
import { createLayer } from "../rendering/createLayer";

export function useLayers() {
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const activeLayer = layers.find(layer => layer.id === activeLayerId) ?? layers[0] ?? null;

  function init(
    gl: WebGL2RenderingContext, 
    width: number, 
    height: number,
    onReady: (gl: WebGL2RenderingContext, layers: Layer[]) => void  // = pushSnapshot from useHistory
  ) {
    glRef.current = gl;

    const first = createLayer(gl, width, height, 'Layer 1');
    const initial = [first];
    setLayers(initial);
    setActiveLayerId(first.id);
    // notifies Canvas.tsx that layers are ready, so initial snapshot can be pushed (important for undo/redo)
    onReady(gl, initial);
  }

  function addLayer() {
    const gl = glRef.current;
    if (!gl) return;

    const canvas = gl.canvas as HTMLCanvasElement;
    const layer = createLayer(gl, canvas.width, canvas.height, `Layer ${layers.length + 1}`);

    // appends to the end ===> since arrays are bottom-to-top, the new layer appears on top this way
    setLayers(prev => [...prev, layer]);
    setActiveLayerId(layer.id);
  }

  function deleteLayer(id: string) {
    if (layers.length === 1) return;

    setLayers(prev => {
      const next = prev.filter(layer => layer.id !== id);

      // if current layer is deleted, the next in line will be set as active layer
      if (activeLayerId === id) {
        setActiveLayerId(next[next.length - 1].id);
      }

      return next;
    });
  }

  function moveLayer(id: string, direction: 'up' | 'down') {
    setLayers(prev => {
      const index = prev.findIndex(layer => layer.id === id);
      if (direction === 'up' && index === prev.length - 1) return prev; // if layer is on top, direction up is cancelled
      if (direction === 'down' && index === 0) return prev;  // if layer is at bottom, direction down is cancelled

      const next = [...prev];
      const swap = direction === 'up' ? index + 1 : index - 1;
      ;[next[index], next[swap]] = [next[swap], next[index]];

      return next;
    });
  }

  function setVisibility(id: string, visible: boolean) {
    setLayers(prev => prev.map(layer => layer.id === id ? { ...layer, visible } : layer))
  }

  function setOpacity(id: string, opacity: number) {
    setLayers(prev => prev.map(layer => layer.id === id ? { ...layer, opacity } : layer))
  }

  function setBlendMode(id: string, blendMode: BlendMode) {
    setLayers(prev => prev.map(layer => layer.id === id ? { ...layer, blendMode } : layer));
  }

  function renameLayer(id: string, name: string) {
    setLayers(prev => prev.map(layer => layer.id === id ? { ...layer, name } : layer));
  }

  return {
    layers,
    activeLayer,
    activeLayerId,
    setActiveLayerId,
    init,
    addLayer,
    deleteLayer,
    moveLayer,
    setVisibility,
    setOpacity,
    setBlendMode,
    renameLayer,
  };
}