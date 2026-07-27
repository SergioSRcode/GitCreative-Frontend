import { buildCommitGraph } from "./commitGraph";
import type { CommitSummary, Branch } from "../api/projects";

// helper to build minimal fake commit for tests because =>
// CommitSummary requires fields like `created_at` and `snapshot_key` which are irrelevant here
function makeCommit(
  id: string, 
  parentId: string | null, 
  message = id, 
  timestampOffset = 0
): CommitSummary {
  const baseTime = new Date('2025-01-01T00:00:00.000Z').getTime();

  return {
    id,
    parent_id: parentId,
    message,
    snapshot_key: `fake-key-${id}`,
    created_at: new Date(baseTime + timestampOffset).toISOString(),
  };
}

function makeBranch(
  id: string,
  name: string,
  headCommitId: string | null
): Branch {
  return { id, name, head_commit_id: headCommitId };
}

describe('buildCommitGraph', () => {
  it('places a single linear chain of commits each in the same lane', () => {
    const commits = [
      makeCommit('c1', null, 'c1', 0),  // oldest
      makeCommit('c2', 'c1', 'c2', 1000),
      makeCommit('c3', 'c2', 'c3', 2000),  // newest
    ];

    const branches = [makeBranch('b1', 'main', 'c3')];

    const graph = buildCommitGraph(commits, branches, null, 'b1');

    console.log(graph.nodes.map(n => ({ id: n.commit.id, lane: n.lane, row: n.row })));

    // all three commits should be in the same lane as no branching happened
    expect(graph.nodes.every(n => n.lane === 0)).toBe(true);
    expect(graph.laneCount).toBe(1);

    // verifies ordering — c3 should be row 0 (newest first)
    expect(graph.nodes[0].commit.id).toBe('c3')
    expect(graph.nodes[2].commit.id).toBe('c1')
  });
});