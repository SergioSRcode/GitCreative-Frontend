const BASE_URL = 'http://localhost:3000/api';

function getToken(): string | null {
  return localStorage.getItem('authToken');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 
      ...authHeaders(), 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function postBinary<T>(path: string, data: Blob): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/octet-stream',
    },
    body: data,
  });

  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function getBinary(path: string): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.arrayBuffer();
}

export const apiClient = { get, post, postBinary, getBinary };