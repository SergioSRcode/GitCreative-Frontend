import { useRef } from "react";

type Props = {
  size: number,
  min?: number,
  max?: number,
  onChange: (size: number) => void,
  onInteracting: (active: boolean) => void,
};

export function SizeBar({ size, min = 1, max = 500, onChange, onInteracting }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // converts a clientY pos to a size value
  // top of bar = max size, bottom = min size, middle = default
  function clientYToSize(clientY: number): number {
    const bar = barRef.current!;
    const rect = bar.getBoundingClientRect();
    const top = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    // inverts top, so top = max, bottom = min
    const inverted = 1 - top;
    return Math.round(min + inverted * (max - min));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    barRef.current!.setPointerCapture(e.pointerId);
    isDragging.current = true;
    onInteracting(true);
    onChange(clientYToSize(e.clientY));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    onChange(clientYToSize(e.clientY));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    isDragging.current = false;
    onChange(clientYToSize(e.clientY));
    onInteracting(false);
  }

  // Thumb position => percentage from top of bar
  const thumbPct = 100 - ((size - min) / (max - min)) * 100;

  return (
    <div style={{
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      userSelect: 'none',
    }}>
      {/* Size label above bar */}
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
        {size}
      </div>

      {/* The bar track — wider hit area via width, visual track stays narrow */}
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
        {/* Visual track */}
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
  );
}