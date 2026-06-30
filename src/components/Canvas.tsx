import { useEffect, useRef, useState } from 'react';
import type { StrokePoint, Stroke } from '../types/stroke';
import type { Brush, Tool } from '../types/brush';
import type { HSVColor, RGBColor } from '../types/color';
import { hsvToRgb, rgbToHsv, rgbToHex } from '../utils/color';
import { resample, smooth } from '../utils/stroke';
import { BrushRenderer } from '../rendering/BrushRenderer';
import { Compositor } from '../rendering/Compositor';
import { sampleColorFromLayer } from '../utils/eyedropper';
import { exportCanvas } from '../utils/export';
import type { ExportFormat } from '../utils/export';
import { useLayers } from '../hooks/useLayers';
import { useHistory } from '../hooks/useHistory';
import { ColorPicker } from './ColorPicker';
import { RecentColors } from './RecentColors';
import { LayerPanel } from './LayerPanel';
import { VerticalBar } from './VerticalBar';
import { BrushPreview } from './BrushPreview';
import { floodFill } from '../utils/fill';

const MAX_RECENT = 10;

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const rendererRef = useRef<BrushRenderer | null>(null);
  const compositorRef = useRef<Compositor | null>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<StrokePoint[]>([]);
  const initializedRef = useRef(false);

  const [hsvColor, setHsvColor] = useState<HSVColor>({ h: 0, s: 1, v: 0 });
  const [recentColors, setRecentColors] = useState<RGBColor[]>([]);
  const [eyedropper, setEyedropper] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [brushSize, setBrushSize] = useState(12);
  const [sizeBarActive, setSizeBarActive] = useState(false);
  const [canvasPixelSize, setCanvasPixelSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<Tool>('ink');
  const [fillTolerance, setFillTolerance] = useState(32);  // range is 0-255
  const [brushOpacity, setBrushOpacity] = useState(1.0);


  const {
    layersRef, layersDisplay, activeLayer, activeLayerId, setActiveLayerId,
    init, addLayer, deleteLayer, moveLayer,
    setVisibility, setOpacity, setBlendMode, renameLayer,
  } = useLayers();

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useHistory();

  const rgb: RGBColor = hsvToRgb(hsvColor);
  const brush: Brush | null = tool === 'fill' 
    ? null
    : {
      type:    tool,
      size:    brushSize,
      opacity: brushOpacity,
      color:   [rgb.r, rgb.g, rgb.b],
    };

  function resizeCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      setCanvasPixelSize({ width: displayWidth, height: displayHeight });
    }
  }

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    return {
      x:         (e.clientX - rect.left) * dpr,
      y:         (e.clientY - rect.top)  * dpr,
      pressure:  e.pressure > 0 ? e.pressure : 0.5,
      timeStamp: e.timeStamp,
    };
  }

  function compositeToScreen() {
    const gl = glRef.current!;
    const canvas = canvasRef.current!;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);

    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      compositorRef.current!.drawLayer(layer, canvas.width, canvas.height);
    }

    // re-enables blending for any subsequent draw calls
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,       gl.ONE_MINUS_SRC_ALPHA
    );
  }

  function renderCurrentStrokeToLayer() {
    const gl = glRef.current;
    if (!gl || !activeLayer || !brush) return;
    if (currentPoints.current.length < 2) return;

    const spacing   = Math.max(brush.size * 0.15, 1);
    const resampled = resample(currentPoints.current, spacing);
    const smoothed  = smooth(resampled, 1);

    const stroke: Stroke = {
      id: 'current',
      points: smoothed,
      color: brush.color,
      size: brush.size,
      opacity: brush.opacity,
    };

    rendererRef.current!.render(
      stroke, brush,
      activeLayer.framebuffer,
      gl.canvas.width, gl.canvas.height
    );

    compositeToScreen();
  }

  function pushRecentColor(color: RGBColor) {
    const hex = rgbToHex(color);

    setRecentColors(prev => {
      const filtered = prev.filter(c => rgbToHex(c) !== hex);
      return [color, ...filtered].slice(0, MAX_RECENT);
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (eyedropper) {
      const gl     = glRef.current!;
      const canvas = canvasRef.current!;
      const point  = getPoint(e);
      const sampled = sampleColorFromLayer(
        gl, layersRef.current[0], point.x, point.y, canvas.height
      );

      setHsvColor(rgbToHsv(sampled));
      setEyedropper(false);

      return;
    }

    if (tool === 'fill') {
      handleFill(e);
      return;
    }

    canvasRef.current!.setPointerCapture(e.pointerId);
    isDrawing.current     = true;
    currentPoints.current = [getPoint(e)];

    pushRecentColor(rgb);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;

    currentPoints.current.push(getPoint(e));
    renderCurrentStrokeToLayer();
    currentPoints.current = currentPoints.current.slice(-1);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;

    isDrawing.current = false;
    currentPoints.current.push(getPoint(e));
    renderCurrentStrokeToLayer();
    currentPoints.current = [];

    // takes snapshot after stroke has been committed to layer texture (used for undo/redo)
    const gl = glRef.current!;
    pushSnapshot(gl, layersRef.current);
  }

  function handleUndo() {
    const gl = glRef.current!;
    if (undo(gl, layersRef.current)) compositeToScreen();
  }

  function handleRedo() {
    const gl = glRef.current!;
    if (redo(gl, layersRef.current)) compositeToScreen();
  }

  async function handleExport(format: ExportFormat) {
    const gl = glRef.current!;
    const canvas = canvasRef.current!;
    await exportCanvas(gl, layersRef.current, canvas.width, canvas.height, format, 'my-painting');
  }

  function handleFill(e: React.PointerEvent<HTMLCanvasElement>) {
    const gl = glRef.current;
    if (!gl || !activeLayer) return;

    const point  = getPoint(e);
    const canvas = canvasRef.current!;
    const x = Math.floor(point.x);
    const y = Math.floor(canvas.height - point.y); // flip Y — same convention as readPixels/eyedropper

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, activeLayer.framebuffer);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const fillColor: [number, number, number, number] = [
      Math.round(rgb.r * 255),
      Math.round(rgb.g * 255),
      Math.round(rgb.b * 255),
      255,
    ];

    const didFill = floodFill(
      pixels, canvas.width, canvas.height,
      x, y, fillColor, fillTolerance
    );

    if (!didFill) return;

    gl.bindTexture(gl.TEXTURE_2D, activeLayer.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      canvas.width, canvas.height,
      gl.RGBA, gl.UNSIGNED_BYTE,
      pixels
    );
    gl.bindTexture(gl.TEXTURE_2D, null);

    compositeToScreen();
    pushSnapshot(gl, layersRef.current);
  }

  useEffect(() => {
    // guards agains React strict mode double-invocation in development
    if (initializedRef.current) return;
    initializedRef.current = true;

    const canvas = canvasRef.current!;
    const gl = canvas.getContext('webgl2');
    if (!gl) { console.error('WebGL2 not supported'); return };

    glRef.current = gl;
    rendererRef.current = new BrushRenderer(gl);
    compositorRef.current = new Compositor(gl);

    resizeCanvas(canvas);
    setCanvasPixelSize({ width: canvas.width, height: canvas.height });
    // init(glRef.current, canvas.width, canvas.height);
    init(gl, canvas.width, canvas.height);

    pushSnapshot(gl, layersRef.current);
    compositeToScreen();

    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key === 'z') {
        e.preventDefault();

        if (e.shiftKey) {
          // cmd+Shift+z => redo
          const gl = glRef.current!;
          if (redo(gl, layersRef.current)) compositeToScreen();
        } else {
          // cmd+z => undo
          const gl = glRef.current!;
          if (undo(gl, layersRef.current)) compositeToScreen();
        }
      }
    }

    function handleResize() {
      resizeCanvas(canvas);
      compositeToScreen();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    }
  }, []); 

  // Re-composite whenever layer state changes (visibility, opacity, order, blend mode)
  useEffect(() => {
    if (glRef.current && compositorRef.current) compositeToScreen();
  }, [layersDisplay]);

  const currentHex = rgbToHex(rgb);

  return (
    <>
      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        background: 'white', border: '1px solid #ddd',
        borderRadius: 10, padding: 12,
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        width: 244,
      }}>

        {/* Undo / Redo */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleUndo}
            disabled={!canUndo()}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 6,
              border: '1px solid #ddd',
              background: canUndo() ? 'white' : '#f8f8f8',
              color: canUndo() ? '#000' : '#bbb',
              cursor: canUndo() ? 'pointer' : 'default',
              fontSize: 13,
            }}
          >↩ Undo</button>
          <button
            onClick={handleRedo}
            disabled={!canRedo()}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 6,
              border: '1px solid #ddd',
              background: canRedo() ? 'white' : '#f8f8f8',
              color: canRedo() ? '#000' : '#bbb',
              cursor: canRedo() ? 'pointer' : 'default',
              fontSize: 13,
            }}
          >↪ Redo</button>
        </div>

        {/* Tool selector — now includes Fill */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['pencil', 'ink', 'eraser', 'fill'] as Tool[]).map(t => (
            <button
              key={t}
              onClick={() => { setTool(t); setEyedropper(false) }}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6,
                border: '1px solid #ddd',
                background: tool === t && !eyedropper ? '#f0f0f0' : 'white',
                fontWeight: tool === t && !eyedropper ? 600 : 400,
                cursor: 'pointer', fontSize: 13,
              }}
            >{t}</button>
          ))}
        </div>

        {/* Fill tolerance slider — only visible while Fill tool is active */}
        {tool === 'fill' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888' }}>Fill tolerance</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setFillTolerance(t => Math.max(0, t - 1))}
                aria-label="Decrease tolerance by 1"
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: '1px solid #ddd', background: 'white',
                  cursor: 'pointer', fontSize: 11, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, padding: 0,
                }}
              >−</button>

              <input
                type="range" min={0} max={255} step={1}
                value={fillTolerance}
                onChange={e => setFillTolerance(parseInt(e.target.value))}
                aria-label="Fill tolerance"
                style={{ flex: 1, minWidth: 0 }}
              />

              <button
                onClick={() => setFillTolerance(t => Math.min(255, t + 1))}
                aria-label="Increase tolerance by 1"
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: '1px solid #ddd', background: 'white',
                  cursor: 'pointer', fontSize: 11, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, padding: 0,
                }}
              >+</button>

              <span style={{
                fontSize: 11, color: '#888',
                width: 26, flexShrink: 0,
                textAlign: 'right',
              }}>
                {fillTolerance}
              </span>
            </div>
          </div>
        )}

        {/* Color swatch + eyedropper */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            onClick={() => setShowPicker(p => !p)}
            title="Pick color"
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: currentHex,
              border: '1px solid rgba(0,0,0,0.15)',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
          <button
            onClick={() => setEyedropper(e => !e)}
            style={{
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid #ddd',
              background: eyedropper ? '#f0f0f0' : 'white',
              cursor: 'pointer', fontSize: 13,
            }}
          >eyedropper</button>
          <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>
            {currentHex}
          </span>
        </div>

        {/* Color picker */}
        {showPicker && (
          <>
            <ColorPicker color={hsvColor} onChange={setHsvColor} />
            <RecentColors
              colors={recentColors}
              onSelect={c => setHsvColor(rgbToHsv(c))}
            />
          </>
        )}

        {/* Export */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['png', 'jpeg'] as ExportFormat[]).map(fmt => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6,
                border: '1px solid #ddd', background: 'white',
                cursor: 'pointer', fontSize: 13,
              }}
            >export {fmt.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {/* Brush size bar — upper half of the left edge */}
        <VerticalBar
          value={brushSize}
          min={1}
          max={500}
          onChange={setBrushSize}
          onInteracting={setSizeBarActive}
          formatLabel={v => String(v)}
        />

        {/* Brush opacity bar — lower half of the left edge */}
        <VerticalBar
          value={brushOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={setBrushOpacity}
          formatLabel={v => `${Math.round(v * 100)}%`}
        />
      </div>
      

      {/* Brush size preview — centred on canvas, visible while interacting */}
      <BrushPreview
        size={brushSize}
        visible={sizeBarActive}
        canvasWidth={canvasPixelSize.width}
        canvasHeight={canvasPixelSize.height}
      />

      {/* Layer panel */}
      <LayerPanel
        layers={layersDisplay}
        activeLayerId={activeLayerId}
        onSelect={setActiveLayerId}
        onAdd={addLayer}
        onDelete={deleteLayer}
        onMoveUp={id => moveLayer(id, 'up')}
        onMoveDown={id => moveLayer(id, 'down')}
        onVisibility={setVisibility}
        onOpacity={setOpacity}
        onBlendMode={setBlendMode}
        onRename={renameLayer}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block', width: '100vw', height: '100vh',
          touchAction: 'none',
          cursor: eyedropper ? 'crosshair' : tool === 'fill' ? 'cell' : 'default',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </>
  )
}