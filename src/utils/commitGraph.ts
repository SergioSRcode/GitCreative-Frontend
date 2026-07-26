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
  type OpenLane = { lane: number; waitingFor: string | null };
  const openLanes: OpenLane[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let nextLane = 0;

  sorted.forEach((commit, row) => {
    // find an open lane waiting for this commit
    let laneEntry = openLanes.find(l => l.waitingFor === commit.id);

    if (!laneEntry) {
      // if no lane is waiting = branch tip with no prior claim => opens new lane
      laneEntry = { lane: nextLane++, waitingFor: commit.id };
      openLanes.push(laneEntry);
    }

    const lane = laneEntry.lane;

    // draws edge to parent if parent exists
    if (commit.parent_id) {
      // checks if another lane is already waiting for the same parent
      // if yes, curr commits edge converges into that lane
      const existingParentLane = openLanes.find(
        l => l.waitingFor === commit.parent_id && l !== laneEntry
      );
      const targetLane = existingParentLane ? existingParentLane.lane : lane;

      edges.push({
        fromRow: row, fromLane: lane,
        toRow: row + 1, toLane: targetLane,
        color: commitBranchColor.get(commit.id) ?? MAIN_COLOR,
      });

      if (existingParentLane) {
        // converges - closes this lane, other lane continues
        openLanes.splice(openLanes.indexOf(laneEntry), 1);
      } else {
        laneEntry.waitingFor = commit.parent_id;
      }
    } else {
      // root commit -> curr lane closed
      openLanes.splice(openLanes.indexOf(laneEntry), 1);
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

  const laneCount = Math.max(1, ...nodes.map(n => n.lane + 1));

  return { nodes, edges, laneCount };
}