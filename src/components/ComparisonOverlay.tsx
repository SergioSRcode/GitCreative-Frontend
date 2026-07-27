import { useEffect, useState } from "react";
import type { CommitSummary, Branch } from "../api/projects";

type Props = {
  commits: CommitSummary[],  // selected in selection order
  allCommits: CommitSummary[],  // full history
  branches: Branch[],
  onClose: () => void,
  onRemove: (commitId: string) => void,
  onFetchThumbnail: (commitId: string, size?: { w: number; h: number }) => Promise<string>,
};

const RENDER_SIZE = { w: 480, h: 360 };

export function ComparisonOverlay({
  commits, allCommits, branches, onClose, onRemove, onFetchThumbnail,
}: Props) {
  const [images, setImages] = useState<Map<string, string>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const commitBranchMap = buildCommitBranchMap(allCommits, branches);
  // fetches a larger render for any commit not already cached
  useEffect(() => {
    let cancelled = false;

    async function loadMissing() {
      for (const commit of commits) {
        if (images.has(commit.id) || loadingIds.has(commit.id)) continue;

        setLoadingIds(prev => new Set(prev).add(commit.id));

        try {
          const url = await onFetchThumbnail(commit.id, RENDER_SIZE);
          if (!cancelled) {
            setImages(prev => new Map(prev).set(commit.id, url));
          }
        } catch {
          // unset - cell shows a fallback
        } finally {
          if (!cancelled) {
            setLoadingIds(prev => {
              const next = new Set(prev);
              next.delete(commit.id);

              return next;
            });
          }
        }
      }
    }
    loadMissing();
    return () => { cancelled = true };
  }, [commits]);

  // auto-fits column count - roughly square grid: 4 -> 2 cols, 6 -> 3 cols...
  const columns = Math.max(1, Math.ceil(Math.sqrt(commits.length)));

  // function branchNameFor(commit: CommitSummary): { name: string; color: string } | null {
  //   const owning = branches.find(b => b.head_commit_id === commit.id);
  //   if (!owning) return null;

  //   return { name: owning.name, color: '#4caf50' };
  // }

  function buildCommitBranchMap(
    allCommits: CommitSummary[],
    branches:   Branch[]
  ): Map<string, { name: string; color: string }[]> {
    const commitById = new Map(allCommits.map(c => [c.id, c]));
    const result = new Map<string, { name: string; color: string }[]>();

    const BRANCH_COLORS = ['#4caf50', '#2196f3', '#9c27b0', '#ff9800', '#e91e63', '#00bcd4', '#ff5722', '#607d8b'];
    let colorIndex = 0;

    const colorFor = (name: string) => {
      if (name === 'main') return '#000000';
      return BRANCH_COLORS[colorIndex++ % BRANCH_COLORS.length];
    };

    for (const branch of branches) {
      const color = colorFor(branch.name);
      let current = branch.head_commit_id;

      while (current) {
        const existing = result.get(current) ?? [];
        // Avoid adding the same branch twice if somehow revisited
        if (!existing.some(b => b.name === branch.name)) {
          result.set(current, [...existing, { name: branch.name, color }]);
        }

        const commit = commitById.get(current);
        current = commit?.parent_id ?? null;
      }
    }

    return result;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12,
          width: '92vw', height: '90vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid #eee', flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            Comparing {commits.length} version{commits.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#888' }}
          >✕</button>
        </div>

        <div style={{
          flex: 1, overflow: 'auto', padding: 20,
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 16,
          alignContent: 'start',
          transition: 'grid-template-columns 0.25s ease',
        }}>
          {commits.map(commit => {
            const img   = images.get(commit.id)
            const labels = commitBranchMap.get(commit.id) ?? [];

            return (
              <div
                key={commit.id}
                style={{
                  border: '1px solid #eee', borderRadius: 10,
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  transition: 'all 0.25s ease',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div style={{
                  aspectRatio: `${RENDER_SIZE.w} / ${RENDER_SIZE.h}`,
                  background: '#f5f5f3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {img ? (
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 12, color: '#ccc' }}>Loading...</span>
                  )}

                  <button
                    onClick={() => onRemove(commit.id)}
                    title="Remove from comparison"
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 22, height: 22, borderRadius: '50%',
                      border: 'none', background: 'rgba(0,0,0,0.55)',
                      color: 'white', cursor: 'pointer', fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
                </div>

                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{commit.message}</span>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#aaa' }}>
                      {new Date(commit.created_at).toLocaleString()}
                    </span>

                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {labels.map(label => (
                        <span
                          key={label.name}
                          style={{
                            fontSize: 9, color: label.color, background: label.color + '18',
                            border: `1px solid ${label.color}`, borderRadius: 3, padding: '1px 5px',
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );  
}