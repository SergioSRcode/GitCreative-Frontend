import { useEffect, useRef, useState } from "react";

type Props = {
  onConfirm: () => void,
};

export function ClearLayerButton({ onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // auto-cancels the confirm state after a few seconds if user doesnt confirm
  useEffect(() => {
    if (!confirming) return;
    timeoutRef.current = setTimeout(() => setConfirming(false), 3000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [confirming]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirming) {
      setConfirming(true);
      return;
    }

    setConfirming(false);
    onConfirm();
  }

  return (
    <button
      onClick={handleClick}
      title={confirming ? 'Click again to confirm' : 'Clear layer'}
      style={{
        border: '1px solid',
        borderColor: confirming ? '#d33' : '#ddd',
        background: confirming ? '#fdeaea' : 'white',
        color: confirming ? '#d33' : '#888',
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 11,
        cursor: 'pointer',
        fontWeight: confirming ? 600 : 400,
      }}
    >
      {confirming ? 'Confirm clear?' : 'Clear'}
    </button>
  );
}