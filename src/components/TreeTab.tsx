import type { CommitSummary, Branch } from "../api/projects";

type Props = {
  commits: CommitSummary[],
  branches: Branch[],
  headCommitId: string | null,
  activeBranchId: string | null,
  onRestore: (commit: CommitSummary) => void,
  onDeleteBranch: (branch: Branch) => void,
};

// assigns each branch a color for visual distinction
const BRANCH_COLORS = [
  '#4caf50', '#2196f3', '#ff9800', '#9c27b0',
  '#e91e63', '#00bcd4', '#ff5722', '#607d8b',
];

export function TreeTab({
  commits, branches, headCommitId, activeBranchId,
  onRestore, onDeleteBranch,
}: Props) {
  // builds a map of commitId -> branches that point to it
  const branchByCommit = new Map<string, Branch[]>();

  for (const branch of branches) {
    if (!branch.head_commit_id) continue;

    const existing = branchByCommit.get(branch.head_commit_id) ?? [];
    branchByCommit.set(branch.head_commit_id, [...existing, branch]);
  }

  // builds a map of commitId -> children (commits that have this as parent)
  const childrenByParent = new Map<string, CommitSummary[]>();

  for (const commit of commits) {
    if (!commit.parent_id) continue;

    const existing = childrenByParent.get(commit.parent_id) ?? [];
    childrenByParent.set(commit.parent_id, [...existing, commit]);
  }

  // assigns branch color by index
  const branchColorMap = new Map<string, string>();
  branches.forEach((branch, i) => {
    branchColorMap.set(branch.id, BRANCH_COLORS[i % BRANCH_COLORS.length]);
  });

  // finds which branch each commit belongs to (the branch whose head chain reaches this commit)
  function getBranchColor(commitId: string): string {
    for (const branch of branches) {
      if (branch.head_commit_id === commitId) {
        return branchColorMap.get(branch.id) ?? '#888';
      }
    }

    return '#888';
  }

  // commits come pre-sorted newest first from the backend
  // tree shows oldes to newest (reversed), so graph reads top-to-bottom
  const ordered = [...commits].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {ordered.length === 0 && (
        <span style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>
          No commits yet
        </span>
      )}

      {ordered.map((commit, i) => {
        const isHead        = commit.id === headCommitId
        const commitBranches = branchByCommit.get(commit.id) ?? []
        const hasChildren   = (childrenByParent.get(commit.id) ?? []).length > 1
        const color         = getBranchColor(commit.id)

        return (
          <div key={commit.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {/* Graph lane */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', flexShrink: 0, width: 16,
            }}>
              {/* Vertical line above */}
              {i > 0 && (
                <div style={{ width: 2, height: 8, background: '#ddd' }} />
              )}
              {/* Commit dot */}
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: isHead ? '#222' : color,
                border: `2px solid ${isHead ? '#222' : color}`,
                flexShrink: 0,
              }} />
              {/* Branch point indicator */}
              {hasChildren && (
                <div style={{ fontSize: 8, color: '#888', lineHeight: 1 }}>╱</div>
              )}
            </div>

            {/* Commit info */}
            <div style={{
              flex: 1, paddingBottom: 8,
              borderBottom: i < ordered.length - 1 ? '1px solid #f0f0f0' : 'none',
            }}>
              {/* Branch labels */}
              {commitBranches.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 3 }}>
                  {commitBranches.map(branch => (
                    <div
                      key={branch.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      <span style={{
                        fontSize: 10, padding: '1px 5px',
                        borderRadius: 3,
                        background: branchColorMap.get(branch.id) ?? '#888',
                        color: 'white', fontWeight: 600,
                      }}>
                        {branch.name}
                      </span>
                      {branch.name !== 'main' && branch.id !== activeBranchId && (
                        <button
                          onClick={() => onDeleteBranch(branch)}
                          title="Delete branch"
                          style={{
                            fontSize: 9, padding: '1px 4px',
                            borderRadius: 3, border: '1px solid #eee',
                            background: 'white', color: '#aaa',
                            cursor: 'pointer', lineHeight: 1,
                          }}
                        >✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: isHead ? 600 : 400 }}>
                    {commit.message}
                  </span>
                  <span style={{ fontSize: 10, color: '#aaa' }}>
                    {new Date(commit.created_at).toLocaleString()}
                  </span>
                </div>

                {!isHead && (
                  <button
                    onClick={() => onRestore(commit)}
                    style={{
                      fontSize: 10, padding: '2px 6px',
                      borderRadius: 4, border: '1px solid #ddd',
                      background: 'white', cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >View</button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
}