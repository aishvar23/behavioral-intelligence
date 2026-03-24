import axios from 'axios';
import { API_BASE_URL } from '../config';

const BASE_URL = API_BASE_URL;

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await axios.post<AuthResponse>(`${BASE_URL}/auth/login`, {
    email,
    password,
  });
  return response.data;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  const response = await axios.post<AuthResponse>(`${BASE_URL}/auth/register`, {
    email,
    password,
    displayName,
  });
  return response.data;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string }> {
  const response = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
  );
  return response.data;
}

export async function logout(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await axios.post(
    `${BASE_URL}/auth/logout`,
    { refreshToken },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export async function getMe(
  accessToken: string,
): Promise<{
  id: number;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}> {
  const response = await axios.get<{
    id: number;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  }>(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

// Social sign-in — Phase 6 will wire up native SDK token acquisition.
// These functions implement the POST call; callers supply the token
// obtained from the native SDK.

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const response = await axios.post<AuthResponse>(`${BASE_URL}/auth/google`, {
    idToken,
  });
  return response.data;
}

export async function loginWithFacebook(
  fbAccessToken: string,
): Promise<AuthResponse> {
  const response = await axios.post<AuthResponse>(
    `${BASE_URL}/auth/facebook`,
    { accessToken: fbAccessToken },
  );
  return response.data;
}
