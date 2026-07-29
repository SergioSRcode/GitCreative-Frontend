import { useRef } from 'react';

type Props = {
  value: number,
  min: number,
  max: number,
  step?: number,
  onChange: (value: number) => void,
  formatLabel?: (value: number) => string,
  width?: number,
};

export function HorizontalBar({
  value, min, max, step = 1,
  onChange,
  formatLabel = v => String(v),
  width = 150,
}: Props) {
  const barRef     = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  function clientXToValue(clientX: number): number {
    const bar  = barRef.current!;
    const rect = bar.getBoundingClientRect();
    const t    = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw  = min + t * (max - min);

    return Math.round(raw / step) * step;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    barRef.current!.setPointerCapture(e.pointerId);
    isDragging.current = true;
    onChange(clientXToValue(e.clientX));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    onChange(clientXToValue(e.clientX));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    isDragging.current = false;
    onChange(clientXToValue(e.clientX));
  }

  const thumbPct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      userSelect: 'none',
    }}>
      <div
        ref={barRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width,
          height: 28,
          borderRadius: 3,
          position: 'relative',
          cursor: 'ew-resize',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{
          height: 6,
          width: '100%',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 3,
          position: 'relative',
          backdropFilter: 'blur(4px)',
        }}>
          {/* Filled portion — grows left to right, mirroring VerticalBar's bottom-up fill */}
          <div style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${thumbPct}%`,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 3,
            transition: 'width 0.05s',
          }} />

          {/* Thumb */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${thumbPct}%`,
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'white',
            border: '1px solid rgba(0,0,0,0.3)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
          }} />
        </div>
      </div>

      <div style={{
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        fontSize: 11,
        borderRadius: 4,
        padding: '2px 6px',
        fontFamily: 'monospace',
        minWidth: 40,
        textAlign: 'center',
        flexShrink: 0,
      }}>
        {formatLabel(value)}
      </div>
    </div>
  );
}