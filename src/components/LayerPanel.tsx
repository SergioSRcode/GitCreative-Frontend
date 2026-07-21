import type { Layer, BlendMode } from "../types/layer";
import { BLEND_MODES } from "../types/layer";
import { ClearLayerButton } from "./ClearLayerButton";

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

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>

      {/* Panel header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onAdd}
          title="Add layer"
          style={{ fontSize: 18, border: 'none', background: 'none', cursor: 'pointer', lineHeight: 1 }}
        >+</button>
      </div>

      {/* Layer rows */}
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

            {/* Blend mode — driven by BLEND_MODES constant, not hardcoded */}
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
          {/* Clear layer — confirm-on-second-click */}
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ClearLayerButton onConfirm={() => onClear(layer.id)} />
          </div>
        </div>
      ))}
    </div>
  );
}