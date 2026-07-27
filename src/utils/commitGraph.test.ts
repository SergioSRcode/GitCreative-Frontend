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

  it('assigns separate lanes when a commit has two children (a branch point)', () => {
    const commits = [
      makeCommit('base',   null,    'base',   0),
      makeCommit('mainTip','base',  'main2',  1000),
      makeCommit('sideTip','base',  'side1',  2000),
    ];
    const branches = [
      makeBranch('b1', 'main', 'mainTip'),
      makeBranch('b2', 'side', 'sideTip'),
    ];

    const graph = buildCommitGraph(commits, branches, null, 'b1');

    const base    = graph.nodes.find(n => n.commit.id === 'base')!;
    const mainTip = graph.nodes.find(n => n.commit.id === 'mainTip')!;
    const sideTip = graph.nodes.find(n => n.commit.id === 'sideTip')!;

    // The two branch tips must be in different lanes — that's the whole point
    // of a branch point, otherwise they'd visually overlap
    expect(mainTip.lane).not.toBe(sideTip.lane);

    // There should be exactly one edge from each tip converging down to `base`
    const edgesToBase = graph.edges.filter(e =>
      e.toRow === base.row && e.toLane === base.lane
    );

    expect(edgesToBase.length).toBe(2);
  });

  it('connects a commit to its parent even when other commits are interleaved between them', () => {
    const commits = [
      makeCommit('c5', 'c4', 'newest on main',      5000),
      makeCommit('sideNew', 'c2', 'side branch tip', 4000), // interleaved — different branch
      makeCommit('c4', 'c3', 'main 4',              3000),
      makeCommit('c3', 'c2', 'main 3',              2000),
      makeCommit('c2', 'c1', 'main 2',              1000),
      makeCommit('c1', null, 'root',                0),
    ];
    const branches = [
      makeBranch('b1', 'main', 'c5'),
      makeBranch('b2', 'side', 'sideNew'),
    ];

    const graph = buildCommitGraph(commits, branches, null, 'b1');

    const c4   = graph.nodes.find(n => n.commit.id === 'c4')!;
    const c3   = graph.nodes.find(n => n.commit.id === 'c3')!;

    // c4's parent is c3 — verify a real edge connects their actual positions,
    // not some assumed adjacent row
    const edge = graph.edges.find(e =>
      e.fromRow === c4.row && e.fromLane === c4.lane &&
      e.toRow === c3.row && e.toLane === c3.lane
    );

    expect(edge).toBeDefined();
  });
});