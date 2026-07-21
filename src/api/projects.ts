import { apiClient } from "./client";

export type CommitSummary = {
  id: string,
  parent_id: string | null,
  message: string,
  snapshot_key: string,
  created_at: string,
};

export type Project = {
  id: string,
  name: string,
  width: number,
  height: number,
  created_at: string,
  updated_at: string,
  main_branch_id: string,
  last_active_branch_id: string | null,
};

export type Branch = {
  id: string,
  name: string,
  head_commit_id: string | null,
};

export async function createProject(
  name: string, width: number, height: number
): Promise<{ projectId: string; branchId: string }> {
  return apiClient.post('/projects', { name, width, height });
}

export async function listProjects(): Promise<{ projects: Project[] }> {
  return apiClient.get('/projects');
}

export async function createCommit(
  projectId: string,
  branchId: string,
  parentCommitId: string | null,
  message: string,
  snapshot: Blob
): Promise<{ commitId: string; snapshotKey: string }> {
  // backend expects message, branchId, parentCommitId as query params
  // body is the raw binary blob
  const params = new URLSearchParams({
    message, 
    branchId,
    ...(parentCommitId ? { parentCommitId } : {}),
  });

  return apiClient.postBinary(`/projects/${projectId}/commits?${params}`, snapshot);
}

export async function listCommits(
  projectId: string
): Promise<{ commits: CommitSummary[] }> {
  return apiClient.get(`/projects/${projectId}/commits`);
}

export async function fetchSnapshot(
  projectId: string,
  commitId: string
): Promise<ArrayBuffer> {
  return apiClient.getBinary(`/projects/${projectId}/commits/${commitId}/snapshot`);
}

export async function deleteProject(projectId: string): Promise<void> {
  return apiClient.del(`/projects/${projectId}`);
}

export async function listBranches(
  projectId: string
): Promise<{ branches: Branch[] }> {
  return apiClient.get(`/projects/${projectId}/branches`);
}

export async function createBranch(
  projectId: string,
  name: string,
  fromCommitId: string
): Promise<{ branchId: string; name: string; headCommitId: string }> {
  return apiClient.post(`/projects/${projectId}/branches`, { name, fromCommitId });
}

export async function deleteBranch(
  projectId: string,
  branchId: string
): Promise<void> {
  return apiClient.del(`/projects/${projectId}/branches/${branchId}`);
}

// Updates branch HEAD after a commit
export async function updateBranchHead(
  projectId: string,
  branchId: string,
  headCommitId: string
): Promise<void> {
  return apiClient.post(`/projects/${projectId}/branches/${branchId}/head`, { headCommitId });
}

export async function listBranchCommits(
  projectId: string,
  branchId:  string
): Promise<{ commits: CommitSummary[] }> {
  return apiClient.get(`/projects/${projectId}/branches/${branchId}/commits`);
}

export async function updateLastBranch(
  projectId: string,
  branchId:  string
): Promise<void> {
  await apiClient.patch(`/projects/${projectId}/lastBranch`, { branchId });
}