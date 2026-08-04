import { useRef } from 'react'

type Props = {
  value: number,
  min: number,
  max: number,
  step?: number,
  onChange: (value: number) => void,
  onInteracting?: (active: boolean) => void,
  formatLabel?: (value: number) => string,
  height?: number,
};

export function VerticalBar({
  value, min, max, step = 1,
  onChange, onInteracting,
  formatLabel = v => String(v),
  height = 150,
}: Props) {
  const barRef     = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const settledValueRef = useRef<number | null>(null);
  const settleTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SETTLE_DELAY = 300; // ms of stillness before a value counts as "settled"

  function clientYToValue(clientY: number): number {
    const bar  = barRef.current!;
    const rect = bar.getBoundingClientRect();
    const t    = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const inverted = 1 - t;
    const raw = min + inverted * (max - min);
    return Math.round(raw / step) * step;
  }

  function scheduleSettle(newValue: number) {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);

    settleTimerRef.current = setTimeout(() => {
      settledValueRef.current = newValue
    }, SETTLE_DELAY);
  }


  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    barRef.current!.setPointerCapture(e.pointerId);
    isDragging.current = true;
    onInteracting?.(true);

    const value = clientYToValue(e.clientY);
    settledValueRef.current = null;
    onChange(value);
    scheduleSettle(value);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    const value = clientYToValue(e.clientY);
    onChange(value);
    scheduleSettle(value);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    isDragging.current = false;

    const finalPointerValue = clientYToValue(e.clientY);
    const valueToUse = settledValueRef.current ?? finalPointerValue;
    onChange(valueToUse);

    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settledValueRef.current = null;

    onInteracting?.(false);
  }

  const thumbPct = 100 - ((value - min) / (max - min)) * 100;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      userSelect: 'none',
    }}>
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

      <div
        ref={barRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={e => e.preventDefault()}
        style={{
          width: 44,
          height,
          borderRadius: 3,
          position: 'relative',
          cursor: 'ns-resize',
          display: 'flex',
          justifyContent: 'center',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
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