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
