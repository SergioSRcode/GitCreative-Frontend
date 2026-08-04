import type { Layer, BlendMode } from "../types/layer";
import { BLEND_MODES } from "../types/layer";
import { ClearLayerButton } from "./ClearLayerButton";
import { useState, useEffect, useRef } from "react";

type Props = {
  layers: Layer[],
  activeLayerId: string | null,
  onSelect: (id: string) => void,
  onAdd: () => void,
  onDelete: (id: string) => void,
  onMoveUp: (id: string) => void,
  onMoveDown: (id: string) => void,
  onVisibility: (id: string, visible: boolean) => void,
  onOpacity: (id: string, opacity: number) => void,
  onBlendMode: (id: string, blendMode: BlendMode) => void,
  onRename: (id: string, name: string) => void,
  onClear: (id: string) => void
};

export function LayerPanel({
  layers, activeLayerId, 
  onSelect, onAdd, onDelete, onMoveUp, onMoveDown, 
  onVisibility, onOpacity, onBlendMode, onRename, onClear,
}: Props) {
  // Reverses for display only => top layer on top
  // spread avoids mutating the array
  const displayed = [...layers].reverse();

  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    setScrollInfo({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    });
  }

  useEffect(() => {
    handleScroll();  // initialize on mount, in case there's already overflow
  }, [layers]);

  // draggable thumb refs and handlers
  const isDraggingThumb = useRef(false);
  const thumbDragStartRef = useRef({ startY: 0, startScrollTop: 0 });

  function handleThumbPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    ;(e.target as HTMLDivElement).setPointerCapture(e.pointerId)

    isDraggingThumb.current = true;
    thumbDragStartRef.current = {
      startY: e.clientY,
      startScrollTop: scrollContainerRef.current?.scrollTop ?? 0,
    };
  }

  function handleThumbPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingThumb.current) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const deltaY = e.clientY - thumbDragStartRef.current.startY;
    const trackHeight = container.clientHeight;
    const scrollableDistance = container.scrollHeight - container.clientHeight;
    const thumbTravelDistance = trackHeight - (trackHeight * (container.clientHeight / container.scrollHeight));
    const scrollRatio = scrollableDistance / thumbTravelDistance;

    container.scrollTop = thumbDragStartRef.current.startScrollTop + deltaY * scrollRatio;
    handleScroll();
  }

  function handleThumbPointerUp() {
    isDraggingThumb.current = false;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          onClick={onAdd}
          title="Add layer"
          style={{ fontSize: 18, border: 'none', background: 'none', cursor: 'pointer', lineHeight: 1 }}
        >+</button>
      </div>

      {/* Scrollable layer list, capped to ~5 rows, with a custom always-visible scroll thumb */}
      <div style={{ position: 'relative' }}>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="layer-list-scroll"
          style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            maxHeight: 5 * 128,
            overflowY: 'auto',
            paddingRight: 12,
          }}
        >
          {displayed.map(layer => (
            <div
              key={layer.id}
              onClick={() => onSelect(layer.id)}
              style={{
                border: `1px solid ${layer.id === activeLayerId ? '#888' : '#eee'}`,
                borderRadius: 8, padding: 8,
                background: layer.id === activeLayerId ? '#f8f8f8' : 'white',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 6,
                flexShrink: 0,
              }}
            >
              {/* Name + delete */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  value={layer.name}
                  onChange={e => onRename(layer.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  aria-label={`Layer name: ${layer.name}`}
                  style={{
                    border: 'none', background: 'none',
                    fontSize: 13, fontWeight: 500,
                    width: '100%', cursor: 'text',
                  }}
                />
                <button
                  onClick={e => { e.stopPropagation(); onDelete(layer.id) }}
                  title="Delete layer"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#aaa' }}
                >✕</button>
              </div>

              {/* Visibility + reorder + blend mode */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  onClick={e => { e.stopPropagation(); onVisibility(layer.id, !layer.visible) }}
                  title={layer.visible ? 'Hide' : 'Show'}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}
                >{layer.visible ? '👁' : '🙈'}</button>

                <button
                  onClick={e => { e.stopPropagation(); onMoveUp(layer.id) }}
                  title="Move up"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}
                >▲</button>

                <button
                  onClick={e => { e.stopPropagation(); onMoveDown(layer.id) }}
                  title="Move down"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}
                >▼</button>

                <select
                  value={layer.blendMode}
                  onChange={e => { e.stopPropagation(); onBlendMode(layer.id, e.target.value as BlendMode) }}
                  onClick={e => e.stopPropagation()}
                  title="Blend mode"
                  style={{ fontSize: 11, border: '1px solid #ddd', borderRadius: 4, padding: '1px 2px' }}
                >
                  {BLEND_MODES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Opacity slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#888', minWidth: 16 }}>Op</span>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={layer.opacity}
                  onChange={e => onOpacity(layer.id, parseFloat(e.target.value))}
                  onClick={e => e.stopPropagation()}
                  aria-label={`Opacity for ${layer.name}`}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 11, color: '#888', minWidth: 28 }}>
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>

              {/* Clear layer */}
              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ClearLayerButton onConfirm={() => onClear(layer.id)} />
              </div>
            </div>
          ))}
        </div>

        {/* Custom draggable scroll thumb — only shown when content actually overflows */}
        {scrollInfo.scrollHeight > scrollInfo.clientHeight && (
          <div style={{
            position: 'absolute',
            top: 0, right: 0,
            width: 10,
            height: '100%',
            background: 'rgba(0,0,0,0.08)',
            borderRadius: 2,
          }}>
            <div
              onPointerDown={handleThumbPointerDown}
              onPointerMove={handleThumbPointerMove}
              onPointerUp={handleThumbPointerUp}
              onPointerLeave={handleThumbPointerUp}
              style={{
                position: 'absolute',
                width: '100%',
                borderRadius: 2,
                background: 'rgba(0,0,0,0.35)',
                top: `${(scrollInfo.scrollTop / scrollInfo.scrollHeight) * 100}%`,
                height: `${(scrollInfo.clientHeight / scrollInfo.scrollHeight) * 100}%`,
                cursor: 'ns-resize',
                touchAction: 'none',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
