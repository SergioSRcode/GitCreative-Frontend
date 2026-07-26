import { useEffect, useRef, useState } from "react";
import type { Branch } from "../api/projects";

type Props = {
  branches: Branch[],
  activeBranchId: string | null,
  onCheckout: (branch: Branch) => void,
  // onCreateBranch: (name: string, fromCommitId: string) => void,
  onDelete: (branch: Branch) => void,
};

type UndoBanner = {
  branch: Branch,
  timeoutId: ReturnType<typeof setTimeout>,
};

export function BranchesTab({
  branches, activeBranchId,
  onCheckout, /*onCreateBranch,*/ onDelete,
}: Props) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [undoBanner, setUndoBanner] = useState<UndoBanner | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // cleans up timers on unmount
  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (undoBanner?.timeoutId) clearTimeout(undoBanner.timeoutId);
    }
  }, [undoBanner]);

  function handleDeleteClick(branch: Branch) {
    if (confirming === branch.id) {
      // second click => optimistic remove + shows undo banner
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirming(null);
      setDeletedIds(prev => new Set([...prev, branch.id]));

      const timeoutId = setTimeout(() => {
        // after 5 secs, real delete happens
        onDelete(branch);
        setUndoBanner(null);
        setDeletedIds(prev => {
          const next = new Set(prev);
          next.delete(branch.id);
          
          return next;
        });
      }, 5000);

      setUndoBanner({ branch, timeoutId });
    } else {
      // First click -> makes button delete ready
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirming(branch.id);
      confirmTimer.current = setTimeout(() => setConfirming(null), 3000);
    }
  }

  function handleUndo() {
    if (!undoBanner) return;

    clearTimeout(undoBanner.timeoutId);
    setDeletedIds(prev => {
      const next = new Set(prev);
      next.delete(undoBanner.branch.id);
      
      return next;
    });

    setUndoBanner(null);
  }

  function handleCloseBanner() {
    if (!undoBanner) return;

    clearTimeout(undoBanner.timeoutId);
    // closes banner immediately => executes delete now
    onDelete(undoBanner.branch);
    setDeletedIds(prev => {
      const next = new Set(prev);
      next.delete(undoBanner.branch.id);

      return next;
    });

    setUndoBanner(null);
  }

  const visibleBranches = branches.filter(b => !deletedIds.has(b.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Undo delete banner */}
      {undoBanner && (
        <div style={{
          background: '#222', color: 'white',
          borderRadius: 6, padding: '8px 10px',
          fontSize: 12, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <span>Deleted "{undoBanner.branch.name}"</span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleUndo}
              style={{
                fontSize: 11, padding: '2px 8px',
                borderRadius: 4, border: '1px solid white',
                background: 'transparent', color: 'white',
                cursor: 'pointer', fontWeight: 600,
              }}
            >Undo</button>
            <button
              onClick={handleCloseBanner}
              style={{
                fontSize: 11, padding: '2px 6px',
                borderRadius: 4, border: 'none',
                background: 'transparent', color: '#aaa',
                cursor: 'pointer',
              }}
            >✕</button>
          </div>
        </div>
      )}

      {/* Branch list */}
      {visibleBranches.map(branch => {
        const isActive  = branch.id === activeBranchId
        const isMain    = branch.name === 'main'
        const isArmed   = confirming === branch.id

        return (
          <div
            key={branch.id}
            style={{
              border: `1px solid ${isActive ? '#888' : '#eee'}`,
              borderRadius: 8, padding: 8,
              background: isActive ? '#f8f8f8' : 'white',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>
                  {branch.name}
                </span>
                {isMain && (
                  <span style={{ fontSize: 10, color: '#aaa', background: '#f0f0f0', borderRadius: 3, padding: '1px 4px' }}>
                    Default
                  </span>
                )}
                {isActive && (
                  <span style={{ fontSize: 10, color: '#4caf50', background: '#e8f5e9', borderRadius: 3, padding: '1px 4px' }}>
                    Current
                  </span>
                )}
              </div>

              {/* Delete button — hidden for main and active branch */}
              {!isMain && !isActive && (
                <button
                  onClick={() => handleDeleteClick(branch)}
                  style={{
                    fontSize: 11, padding: '2px 6px',
                    borderRadius: 4,
                    border: `1px solid ${isArmed ? '#d33' : '#eee'}`,
                    background: isArmed ? '#fdeaea' : 'white',
                    color: isArmed ? '#d33' : '#aaa',
                    cursor: 'pointer',
                    fontWeight: isArmed ? 600 : 400,
                  }}
                >
                  {isArmed ? 'Confirm?' : '✕'}
                </button>
              )}
            </div>

            {/* Checkout button — hidden for active branch */}
            {!isActive && (
              <button
                onClick={() => onCheckout(branch)}
                style={{
                  fontSize: 11, padding: '3px 0',
                  borderRadius: 4, border: '1px solid #ddd',
                  background: 'white', cursor: 'pointer',
                }}
              >Switch to this</button>
            )}
          </div>
        )
      })}
    </div>
  );
}