import { useState, useRef, useEffect } from "react";
import type { Layer, BlendMode } from "../types/layer";
import { createLayer } from "../rendering/createLayer";

export function useLayers() {
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const layersRef = useRef<Layer[]>([]);

  // separating useState purely to trigger LayerPanel re-renders
  const [layersDisplay, setLayersDisplay] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);


  const [activeLayer, setActiveLayer] = useState<Layer | null>(null);
  // always reads from the layersRef for rendering
  useEffect(() => {
    const layer = layersRef.current.find(l => l.id === activeLayerId)
    ?? layersRef.current[0]
    ?? null;

    setActiveLayer(layer);
  }, [activeLayerId, layersDisplay]);

  // let activeLayer = layersRef.current.find(l => l.id === activeLayerId);
  // activeLayer ?? layersRef.current[0] ?? null;

  // syncs ref into display state so panel re-renders
  function syncDisplay() {
    setLayersDisplay([...layersRef.current]);
  }

  function init(gl: WebGL2RenderingContext, width: number, height: number) {
    glRef.current = gl;
    const first = createLayer(gl, width, height, 'Layer 1');

    layersRef.current = [first];
    setActiveLayerId(first.id);
    syncDisplay();
  }

  function addLayer() {
    const gl = glRef.current;
    if (!gl) return;

    const canvas = gl.canvas as HTMLCanvasElement;
    const layer = createLayer(gl, canvas.width, canvas.height, `Layer ${layersRef.current.length + 1}`);

    // appends to the end ===> since arrays are bottom-to-top, the new layer appears on top this way
    layersRef.current = [...layersRef.current, layer];
    setActiveLayerId(layer.id);
    syncDisplay();
  }

  function deleteLayer(id: string) {
    if (layersRef.current.length === 1) return;

    layersRef.current = layersRef.current.filter(layer => layer.id !== id);
    if (activeLayerId === id) {
      setActiveLayerId(layersRef.current[layersRef.current.length - 1].id);
    }

    syncDisplay();
  }

  function moveLayer(id: string, direction: 'up' | 'down') {
    const layers = layersRef.current;
    const index = layers.findIndex(layer => layer.id === id);

    if (direction === 'up'   && index === layers.length - 1) return;
    if (direction === 'down' && index === 0) return;

    const next = [...layers];
    const swap = direction === 'up' ? index + 1 : index - 1;
    ;[next[index], next[swap]] = [next[swap], next[index]];
    layersRef.current = next;

    syncDisplay();
  }

  function setVisibility(id: string, visible: boolean) {
    layersRef.current = layersRef.current.map(layer =>
      layer.id === id ? { ...layer, visible } : layer
    );

    syncDisplay();
  }

  function setOpacity(id: string, opacity: number) {
    layersRef.current = layersRef.current.map(layer =>
      layer.id === id ? { ...layer, opacity } : layer
    );

    syncDisplay();
  }

  function setBlendMode(id: string, blendMode: BlendMode) {
    layersRef.current = layersRef.current.map(layer =>
      layer.id === id ? { ...layer, blendMode } : layer
    );

    syncDisplay();
  }

  function renameLayer(id: string, name: string) {
    layersRef.current = layersRef.current.map(layer =>
      layer.id === id ? { ...layer, name } : layer
    );

    syncDisplay();
  }

  function clearLayer(id: string) {
    const gl = glRef.current;
    if (!gl) return;

    const layer = layersRef.current.find(l => l.id === id);
    if (!layer) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    syncDisplay();
  }

  return {
    layersRef,
    layersDisplay,
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
    clearLayer,
  };
}