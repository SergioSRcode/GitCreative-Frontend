import { useRef } from 'react';

type Props = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onInteracting?: (active: boolean) => void;
  formatLabel?: (value: number) => string;
  left: number;  // horizontal position — lets us place multiple bars side by side
}

export function VerticalBar({
  value, min, max, step = 1,
  onChange, onInteracting,
  formatLabel = v => String(v),
  left,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  function clientYToValue(clientY: number): number {
    const bar  = barRef.current!;
    const rect = bar.getBoundingClientRect();
    const t    = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const inverted = 1 - t;
    const raw = min + inverted * (max - min);
    // Snap to step
    return Math.round(raw / step) * step;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    barRef.current!.setPointerCapture(e.pointerId);
    isDragging.current = true;
    onInteracting?.(true);
    onChange(clientYToValue(e.clientY));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    onChange(clientYToValue(e.clientY));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    isDragging.current = false;
    onChange(clientYToValue(e.clientY));
    onInteracting?.(false);
  }

  const thumbPct = 100 - ((value - min) / (max - min)) * 100;

  return (
    <div style={{
      position: 'absolute',
      left,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      userSelect: 'none',
    }}>
      {/* Value label above bar */}
      <div style={{
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        fontSize: 11,
        borderRadius: 4,
        padding: '2px 6px',
        fontFamily: 'monospace',
        minWidth: 32,
        textAlign: 'center',
      }}>
        {formatLabel(value)}
      </div>

      {/* The bar track — wider hit area, narrow visual track inside */}
      <div
        ref={barRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width: 28,
          height: 180,
          borderRadius: 3,
          position: 'relative',
          cursor: 'ns-resize',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{
          width: 6,
          height: '100%',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 3,
          position: 'relative',
          backdropFilter: 'blur(4px)',
        }}>
          {/* Filled portion */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${100 - thumbPct}%`,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 3,
            transition: 'height 0.05s',
          }} />

          {/* Thumb */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: `${thumbPct}%`,
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
    </div>
  )
}