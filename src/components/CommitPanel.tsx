import type { CommitSummary } from "../api/projects";

type Props = {
  commits: CommitSummary[],
  headCommitId: string | null,
  commitMessage: string,
  committing: boolean,
  onMessageChange: (msg: string) => void,
  onCommit: () => void,
  onRestore: (commit: CommitSummary) => void,
};

export function CommitPanel({
  commits, headCommitId,
  commitMessage, committing,
  onMessageChange, onCommit, onRestore,
}: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 10, right: 10, zIndex: 10,
      background: 'white', border: '1px solid #ddd',
      borderRadius: 10, padding: 12, width: 260,
      boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      display: 'flex', flexDirection: 'column', gap: 10,
      maxHeight: '60vh', overflow: 'hidden',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Commits</span>

      {/* New commit input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={commitMessage}
          onChange={e => onMessageChange(e.target.value)}
          placeholder="Commit message..."
          aria-label="Commit message"
          onKeyDown={e => { if (e.key === 'Enter') onCommit() }}
          style={{
            border: '1px solid #ddd', borderRadius: 6,
            padding: '5px 8px', fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={onCommit}
          disabled={committing || !commitMessage.trim()}
          style={{
            padding: '5px 0', borderRadius: 6,
            border: '1px solid #ddd',
            background: commitMessage.trim() && !committing ? '#f0f0f0' : '#f8f8f8',
            color: commitMessage.trim() && !committing ? '#000' : '#bbb',
            cursor: commitMessage.trim() && !committing ? 'pointer' : 'default',
            fontSize: 13, fontWeight: 500,
          }}
        >
          {committing ? 'Saving...' : '📸 Commit'}
        </button>
      </div>

      {/* Commit history list */}
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {commits.length === 0 && (
          <span style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
            No commits yet
          </span>
        )}
        {commits.map(commit => (
          <div
            key={commit.id}
            style={{
              border: `1px solid ${commit.id === headCommitId ? '#888' : '#eee'}`,
              borderRadius: 8, padding: 8,
              background: commit.id === headCommitId ? '#f8f8f8' : 'white',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
                {commit.message}
              </span>
              {commit.id !== headCommitId && (
                <button
                  onClick={() => onRestore(commit)}
                  style={{
                    fontSize: 11, padding: '2px 8px',
                    borderRadius: 4, border: '1px solid #ddd',
                    background: 'white', cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >Restore</button>
              )}
              {commit.id === headCommitId && (
                <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>HEAD</span>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#aaa' }}>
              {new Date(commit.created_at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}