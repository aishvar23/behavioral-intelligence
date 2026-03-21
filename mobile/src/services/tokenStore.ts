/**
 * Module-level in-memory token store.
 * Allows axios interceptors to read the access token synchronously
 * without async SecureStore access on every request.
 */

let _accessToken: string | null = null;
let _refreshToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setRefreshToken(token: string | null): void {
  _refreshToken = token;
}

export function getRefreshToken(): string | null {
  return _refreshToken;
}
