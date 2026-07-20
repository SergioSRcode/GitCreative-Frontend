import { apiClient } from "./client";

export type AuthResponse = {
  token: string,
  user: {
    id: string,
    email: string,
    displayName: string,
  },
};

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiClient.post('/auth/login', { email, password });
}

export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResponse> {
  return apiClient.post('/auth/register', { email, password, displayName });
}
