import type { CommitSummary } from "../api/projects";
import { useState, useEffect, useRef } from "react";

type Props = {
  commits: CommitSummary[],
  headCommitId: string | null,
  viewingCommitId: string | null,
  commitMessage: string,
  committing: boolean,
  isDetached: boolean,
  onCommitMessageChange: (msg: string) => void,
  onCommit: () => void,
  onRestore: (commit: CommitSummary) => void,
  onCreateBranch: (commit: CommitSummary) => void,
  onTimelinePreview: (commit: CommitSummary) => void,
  onTimelinePreviewEnd: () => void;
  onFetchThumbnail: (commitId: string) => Promise<string>,
};

export function CommitsTab({
  commits, headCommitId, viewingCommitId,
  commitMessage, committing, isDetached,
  onCommitMessageChange, onCommit,
  onRestore, onCreateBranch,
  onTimelinePreview, onTimelinePreviewEnd, onFetchThumbnail,
}: Props) {
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [isPreviewingOnHover, setIsPreviewingOnHover] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lazily load thumbnails for visible commits
  useEffect(() => {
    let cancelled = false;

    async function loadThumbs() {
      for (const c of commits) {
        if (thumbs.has(c.id)) continue;

        try {
          const url = await onFetchThumbnail(c.id);
          if (!cancelled) setThumbs(prev => new Map(prev).set(c.id, url));
        } catch { /* ignore individual failures */ }
      }
    }
    loadThumbs();

    return () => { cancelled = true };
  }, [commits])

  function handleMouseEnter(commit: CommitSummary) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    // Small debounce so quickly passing the mouse over several rows
    // doesn't trigger a fetch+render for each one
    hoverTimer.current = setTimeout(() => {
      setIsPreviewingOnHover(true);
      onTimelinePreview(commit);
    }, 150);
  }

  function handleMouseLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    onTimelinePreviewEnd();
    setIsPreviewingOnHover(false);
  }

  const canCommit = commitMessage.trim() && !committing && !isPreviewingOnHover;

  function handleCommitClick() {
    if (!canCommit) return;
    onCommit();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {isDetached && (
        <div style={{
          background: '#fff8e1', border: '1px solid #ffe082',
          borderRadius: 6, padding: '8px 10px',
          fontSize: 12, color: '#7a6000', lineHeight: 1.4,
        }}>
          You're looking back at an earlier version. 
          To keep painting from here, save it as a new version line.
        </div>
      )}

      {!isDetached && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={commitMessage}
            onChange={e => onCommitMessageChange(e.target.value)}
            placeholder="Describe what changed..."
            aria-label="Version description"
            onKeyDown={e => { if (e.key === 'Enter') handleCommitClick() }}
            style={{
              border: '1px solid #ddd', borderRadius: 6,
              padding: '5px 8px', fontSize: 12, outline: 'none',
            }}
          />
          <button
            onClick={handleCommitClick}
            disabled={!canCommit}
            style={{
              padding: '5px 0', borderRadius: 6,
              border: '1px solid #ddd',
              background: canCommit ? '#f0f0f0' : '#f8f8f8',
              color: canCommit ? '#000' : '#bbb',
              cursor: canCommit ? 'pointer' : 'default',
              fontSize: 12, fontWeight: 500,
            }}
          >
            {committing ? 'Saving...' : '📸 Make a Version Snapshot'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {commits.length === 0 && (
          <span style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
            No commits yet
          </span>
        )}

        {commits.map(commit => {
          const isHead    = commit.id === headCommitId
          const isViewing = commit.id === viewingCommitId
          const isCurrent = isHead && !isDetached
          const thumb     = thumbs.get(commit.id)

          return (
            <div
              key={commit.id}
              onMouseEnter={() => handleMouseEnter(commit)}
              onMouseLeave={handleMouseLeave}
              style={{
                border: `1px solid ${isViewing ? '#888' : '#eee'}`,
                borderRadius: 8, padding: 8,
                background: isViewing ? '#f8f8f8' : 'white',
                display: 'flex', gap: 8,
              }}
            >
              {/* Thumbnail */}
              <div style={{
                width: 48, height: 36, flexShrink: 0,
                borderRadius: 4, overflow: 'hidden',
                background: '#f5f5f3', border: '1px solid #eee',
              }}>
                {thumb ? (
                  <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#ccc' }}>
                    ...
                  </div>
                )}
              </div>

              {/* Commit info */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>
                    {commit.message}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, color: '#888', flexShrink: 0 }}>Latest</span>
                  )}
                  {isDetached && isViewing && (
                    <span style={{ fontSize: 10, color: '#7a6000', flexShrink: 0 }}>Looking at this</span>
                  )}
                </div>

                <span style={{ fontSize: 10, color: '#aaa' }}>
                  {new Date(commit.created_at).toLocaleString()}
                </span>

                <div style={{ display: 'flex', gap: 4 }}>
                  {!isViewing && (
                    <button
                      onClick={() => onRestore(commit)}
                      style={{
                        fontSize: 10, padding: '2px 6px',
                        borderRadius: 4, border: '1px solid #ddd',
                        background: 'white', cursor: 'pointer',
                      }}
                    >Look at this</button>
                  )}
                  
                  <button
                    onClick={() => onCreateBranch(commit)}
                    style={{
                      fontSize: 10, padding: '2px 6px',
                      borderRadius: 4, border: '1px solid #4caf50',
                      color: '#4caf50', background: 'white',
                      cursor: 'pointer',
                    }}
                  >Continue from here</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}