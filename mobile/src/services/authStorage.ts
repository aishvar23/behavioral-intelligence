import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS_TOKEN = 'bi_access_token';
const KEY_REFRESH_TOKEN = 'bi_refresh_token';
const KEY_USER_JSON = 'bi_user_json';

export interface StoredUser {
  userId: number;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  user: StoredUser,
): Promise<void> {
  await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, refreshToken);
  await SecureStore.setItemAsync(KEY_USER_JSON, JSON.stringify(user));
}

export async function loadTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
} | null> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(KEY_ACCESS_TOKEN),
    SecureStore.getItemAsync(KEY_REFRESH_TOKEN),
    SecureStore.getItemAsync(KEY_USER_JSON),
  ]);

  if (!accessToken || !refreshToken || !userJson) {
    return null;
  }

  let user: StoredUser;
  try {
    user = JSON.parse(userJson) as StoredUser;
  } catch {
    return null;
  }

  return { accessToken, refreshToken, user };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN),
    SecureStore.deleteItemAsync(KEY_USER_JSON),
  ]);
}
