import type { CommitSummary, Branch } from "../api/projects";

export type GraphNode = {
  commit: CommitSummary,
  lane: number,
  row: number,
  branchColor: string,
  branchLabels: { name: string; color: string; isActive: boolean}[],
  isCurrent: boolean,
};

export type GraphEdge = {
  fromRow: number,
  fromLane: number,
  toRow: number,
  toLane: number,
  color: string,
};

export type CommitGraph = {
  nodes: GraphNode[],
  edges: GraphEdge[],
  laneCount: number,
};

const MAIN_COLOR = '#000000';
const BRNACH_COLORS = [
  '#2196f3', '#9c27b0', '#ff9800', '#4caf50',
  '#e91e63', '#00bcd4', '#ff5722', '#607d8b',
];

function colorForBranch(branchName: string, index: number): string {
  if (branchName === 'main') return MAIN_COLOR;
  return BRNACH_COLORS[index % BRNACH_COLORS.length];
}

export function buildCommitGraph(
  commits: CommitSummary[],
  branches: Branch[],
  viewingCommitId: string | null,
  activeBranchId: string | null
): CommitGraph {
  // sorts newest first
  const sorted = [...commits].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // assigns each branch a stable color based on position in branches arr
  const branchColorMap = new Map<string, string>();
  let colorIndex = 0;

  for (const branch of branches) {
    branchColorMap.set(branch.id, colorForBranch(branch.name, colorIndex));
    if (branch.name !== 'main') colorIndex++;
  }

  // maps commitId 
  const branchesByCommit = new Map<string, Branch[]>();
  for (const branch of branches) {
    if (!branch.head_commit_id) continue;
    const list = branchesByCommit.get(branch.head_commit_id) ?? [];
    branchesByCommit.set(branch.head_commit_id, [...list, branch]);
  }

  // determines which branch `owns` each commit and colors all
  // commits of a certain branch in one color. 
  const commitBranchColor = new Map<string, string>();
  const sortedByRecency = [...branches].sort((a, b) => {
    return a.name === 'main' ? -1 : b.name === 'main' ? 1 : 0;
  });

  for (const branch of sortedByRecency) {
    let current = branch.head_commit_id;
    const color = branchColorMap.get(branch.id) ?? MAIN_COLOR;
    
    while (current) {
      if (commitBranchColor.has(current)) break;
      commitBranchColor.set(current, color);
      const commit = sorted.find(c => c.id === current);
      current = commit?.parent_id ?? null;
    }
  }

  // lane assignment
  type OpenLane = { lane: number; waitingFor: string };
  const openLanes: OpenLane[] = [];
  const placements = new Map<string, { row: number; lane: number }>();
  const nodes: GraphNode[] = [];
  // const edges: GraphEdge[] = [];
  let nextLane = 0;

  sorted.forEach((commit, row) => {
    // find all open lanes waiting for this commit
    const waitingLanes = openLanes.filter(l => l.waitingFor === commit.id);

    let primaryLane: OpenLane;

    if (waitingLanes.length === 0) {
      // opens a fresh lane (a branch tip with no children yet)
      primaryLane = { lane: nextLane++, waitingFor: commit.id };
      openLanes.push(primaryLane);
    } else {
      // Uses the first waiting lane as curr node's column
      primaryLane = waitingLanes[0];

      // Any additional lanes waiting for this commit converge at this point 
      for (let i = 1; i < waitingLanes.length; i++) {
        openLanes.splice(openLanes.indexOf(waitingLanes[i]), 1);
      }
    }

    const lane = primaryLane.lane;
    placements.set(commit.id, { row, lane });


    // draws edge to parent if parent exists
    if (commit.parent_id) {
      primaryLane.waitingFor = commit.parent_id;
    } else {
      // root commit -> closes lane
      openLanes.splice(openLanes.indexOf(primaryLane), 1);
    }

    const labels = (branchesByCommit.get(commit.id) ?? []).map(b => ({
      name: b.name,
      color: branchColorMap.get(b.id) ?? MAIN_COLOR,
      isActive: b.id === activeBranchId,
    }));

    nodes.push({
      commit,
      lane,
      row,
      branchColor: commitBranchColor.get(commit.id) ?? MAIN_COLOR,
      branchLabels: labels,
      isCurrent: commit.id === viewingCommitId,
    });
  });

  // Pass 2 — draws edges using each commit's ACTUAL placement, not an assumed row+1.
  // This is what fixes disconnected lines: every child now connects directly
  // to wherever its parent really ended up, however many rows apart that is.
  const edges: GraphEdge[] = [];
  sorted.forEach(commit => {
    if (!commit.parent_id) return;

    const from = placements.get(commit.id);
    const to   = placements.get(commit.parent_id);
    if (!from || !to) return;

    edges.push({
      fromRow: from.row, fromLane: from.lane,
      toRow:   to.row,   toLane:   to.lane,
      color:   commitBranchColor.get(commit.id) ?? MAIN_COLOR,
    });
  });

  const laneCount = Math.max(1, ...nodes.map(n => n.lane + 1));

  return { nodes, edges, laneCount };
}