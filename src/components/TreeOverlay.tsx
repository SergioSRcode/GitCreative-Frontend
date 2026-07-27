import { useState, useRef } from "react";
import type { CommitSummary, Branch } from "../api/projects";
import { buildCommitGraph } from "../utils/commitGraph";
import { ComparisonOverlay } from "./ComparisonOverlay";

type Props = {
  commits: CommitSummary[],
  branches: Branch[],
  viewingCommitId: string | null,
  activeBranchId: string | null,
  onClose: () => void,
  onRestore: (commit: CommitSummary) => void,
  onFetchThumbnail: (commitId: string) => Promise<string>,  // returns object URL
};

const SQUARE_W = 84;
const SQUARE_H = 40;
const LANE_GAP = 100;
const ROW_GAP  = 64;
const PAD      = 40;

export function TreeOverlay({
  commits, branches, viewingCommitId, activeBranchId,
  onClose, onRestore, onFetchThumbnail,
}: Props) {
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);
  const [thumbUrl,      setThumbUrl]      = useState<string | null>(null);
  const [thumbLoading,  setThumbLoading]  = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection mode
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<CommitSummary[]>([]);
  const [comparing, setComparing] = useState(false);

  // Commit graph including all branches
  const graph = buildCommitGraph(commits, branches, viewingCommitId, activeBranchId);

  const width = PAD * 2 + graph.laneCount * LANE_GAP;
  const height = PAD * 2 + graph.nodes.length * ROW_GAP;

  function laneX(lane: number) { return PAD + lane * LANE_GAP + SQUARE_W / 2 };
  function rowY(row: number) { return PAD + row * ROW_GAP + SQUARE_H / 2 };

  async function handleHover(commitId: string) {
    if (compareMode) return;  // no thumbnail preview while selecting

    setHoveredCommit(commitId);
    setThumbLoading(true);

    try {
      const url = await onFetchThumbnail(commitId);
      setThumbUrl(url);
    } catch {
      setThumbUrl(null);
    } finally {
      setThumbLoading(false);
    }
  }

  function handleLeave() {
    setHoveredCommit(null);
    setThumbUrl(null);
  }

  function handleTouchStart(commitId: string) {
    if (compareMode) return;  // no checkout while selecting
    longPressTimer.current = setTimeout(() => handleHover(commitId), 2000);
  }

  function handleTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    handleLeave();
  }

  function handleSquareClick(commit: CommitSummary) {  // necessary??
    if (!compareMode) {
      onRestore(commit);
      return;
    }

    // toggle selection
    setSelected(prev => {
      const exists = prev.some(c => c.id === commit.id);
      if (exists) return prev.filter(c => c.id !== commit.id);
      return [...prev, commit];  // appended at the end - preserves selection order
    });
  }

  function isSelected(commitId: string) {
    return selected.some(c => c.id === commitId);
  }

  function toggleCompareMode() {
    setCompareMode(m => !m);
    setSelected([]);  // clear selection when mode is toggled
  }

  function handleRemoveFromComparison(commitId: string) {
    setSelected(prev => prev.filter(c => c.id !== commitId));
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12,
          width: '90vw', height: '85vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid #eee', flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Version history</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={toggleCompareMode}
              style={{
                fontSize: 12, padding: '5px 12px', borderRadius: 6,
                border: `1px solid ${compareMode ? '#222' : '#ddd'}`,
                background: compareMode ? '#222' : 'white',
                color: compareMode ? 'white' : '#333',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              {compareMode ? 'Cancel comparing' : 'Compare versions'}
            </button>

            {compareMode && selected.length > 0 && (
              <button
                onClick={() => setComparing(true)}
                style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 6,
                  border: '1px solid #4caf50', background: '#4caf50',
                  color: 'white', cursor: 'pointer', fontWeight: 500,
                }}
              >
                Compare ({selected.length})
              </button>
            )}

            <button
              onClick={onClose}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#888' }}
            >✕</button>
          </div>
        </div>

        {compareMode && (
          <div style={{
            padding: '8px 20px', fontSize: 12, color: '#888',
            borderBottom: '1px solid #f5f5f3', flexShrink: 0,
          }}>
            Click any version to add it to the comparison. Click again to remove it.
          </div>
        )}

        {/* Scrollable graph area */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative', padding: 20 }}>
          <svg width={width} height={height} style={{ display: 'block' }}>
            {graph.edges.map((edge, i) => {
              const x1 = laneX(edge.fromLane)
              const y1 = rowY(edge.fromRow) + SQUARE_H / 2
              const x2 = laneX(edge.toLane)
              const y2 = rowY(edge.toRow) - SQUARE_H / 2

              if (edge.fromLane === edge.toLane) {
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={edge.color} strokeWidth={2} />
              }
              return (
                <polyline
                  key={i}
                  points={`${x1},${y1} ${x1},${y2} ${x2},${y2}`}
                  fill="none" stroke={edge.color} strokeWidth={2}
                />
              )
            })}

            {graph.nodes.map(node => {
              const x = laneX(node.lane) - SQUARE_W / 2
              const y = rowY(node.row) - SQUARE_H / 2
              const selectedHere = isSelected(node.commit.id)

              return (
                <g
                  key={node.commit.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSquareClick(node.commit)}
                  onMouseEnter={() => handleHover(node.commit.id)}
                  onMouseLeave={handleLeave}
                  onTouchStart={() => handleTouchStart(node.commit.id)}
                  onTouchEnd={handleTouchEnd}
                >
                  <rect
                    x={x} y={y} width={SQUARE_W} height={SQUARE_H}
                    rx={6}
                    fill={node.isCurrent && !compareMode ? node.branchColor : selectedHere ? '#e8f5e9' : 'white'}
                    stroke={selectedHere ? '#4caf50' : node.branchColor}
                    strokeWidth={node.isCurrent && !compareMode ? 0 : selectedHere ? 3 : 2}
                  />
                  <text
                    x={x + SQUARE_W / 2} y={y + SQUARE_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily="monospace"
                    fill={node.isCurrent && !compareMode ? 'white' : node.branchColor}
                  >
                    {node.commit.message.length > 10
                      ? node.commit.message.slice(0, 9) + '...'
                      : node.commit.message}
                    <title>{node.commit.message}</title>
                  </text>

                  {selectedHere && (
                    <text
                      x={x + SQUARE_W - 4} y={y + 12}
                      textAnchor="end" fontSize={11} fontWeight={700}
                      fill="#4caf50"
                    >
                      {selected.findIndex(c => c.id === node.commit.id) + 1}
                    </text>
                  )}

                  {node.isCurrent && !compareMode && (
                    <text x={x + SQUARE_W / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill="#222">
                      you are here
                    </text>
                  )}

                  {node.branchLabels.map((label, li) => (
                    <g key={label.name} transform={`translate(${x + SQUARE_W + 6}, ${y + li * 16})`}>
                      <rect width={label.name.length * 6 + 10} height={14} rx={3} fill={label.color + '22'} stroke={label.color} strokeWidth={1} />
                      <text x={5} y={10.5} fontSize={10} fontFamily="monospace" fill={label.color} fontWeight={label.isActive ? 700 : 400}>
                        {label.name}
                      </text>
                    </g>
                  ))}
                </g>
              )
            })}
          </svg>

          {hoveredCommit && !compareMode && (
            <div style={{
              position: 'fixed', pointerEvents: 'none',
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'white', border: '1px solid #ddd', borderRadius: 8,
              padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 200,
            }}>
              {thumbLoading ? (
                <div style={{ width: 200, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#aaa' }}>Loading...</div>
              ) : thumbUrl ? (
                <img src={thumbUrl} alt="Commit preview" style={{ width: 200, height: 150, objectFit: 'contain', display: 'block' }} />
              ) : (
                <div style={{ width: 200, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#aaa' }}>No preview</div>
              )}
            </div>
          )}
        </div>
      </div>

      {comparing && (
        <ComparisonOverlay
          commits={selected}
          branches={branches}
          onClose={() => setComparing(false)}
          onRemove={handleRemoveFromComparison}
          onFetchThumbnail={onFetchThumbnail}
        />
      )}
    </div>
  );
}