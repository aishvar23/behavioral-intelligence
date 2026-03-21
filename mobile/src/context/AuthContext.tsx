import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import * as authApi from '../services/authApi';
import {
  saveTokens,
  loadTokens,
  clearTokens,
  StoredUser,
} from '../services/authStorage';
import {
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
} from '../services/tokenStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthState {
  userId: number | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
  isLoading: boolean;
}

export interface AuthContextValue {
  auth: AuthState;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithFacebook: (fbAccessToken: string) => Promise<void>;
  registerWithEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_STATE: AuthState = {
  userId: null,
  displayName: null,
  email: null,
  avatarUrl: null,
  isGuest: false,
  isLoading: true,
};

function authStateFromUser(user: StoredUser): Partial<AuthState> {
  return {
    userId: user.userId,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isGuest: false,
    isLoading: false,
  };
}

function applyAuthResponse(
  res: authApi.AuthResponse,
): Partial<AuthState> {
  return {
    userId: res.user.id,
    displayName: res.user.displayName,
    email: res.user.email,
    avatarUrl: res.user.avatarUrl,
    isGuest: false,
    isLoading: false,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(INITIAL_STATE);

  // On mount: attempt to restore session from SecureStore
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadTokens();
        if (stored) {
          setAccessToken(stored.accessToken);
          setRefreshToken(stored.refreshToken);
          setAuth(prev => ({
            ...prev,
            ...authStateFromUser(stored.user),
          }));
        } else {
          setAuth(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        setAuth(prev => ({ ...prev, isLoading: false }));
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Shared post-sign-in handler
  // ---------------------------------------------------------------------------

  async function handleAuthResponse(res: authApi.AuthResponse): Promise<void> {
    const user: StoredUser = {
      userId: res.user.id,
      displayName: res.user.displayName,
      email: res.user.email,
      avatarUrl: res.user.avatarUrl,
    };
    await saveTokens(res.accessToken, res.refreshToken, user);
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    setAuth(prev => ({ ...prev, ...applyAuthResponse(res) }));
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function signInWithEmail(email: string, password: string): Promise<void> {
    const res = await authApi.loginWithEmail(email, password);
    await handleAuthResponse(res);
  }

  async function signInWithGoogle(idToken: string): Promise<void> {
    const res = await authApi.loginWithGoogle(idToken);
    await handleAuthResponse(res);
  }

  async function signInWithFacebook(fbAccessToken: string): Promise<void> {
    const res = await authApi.loginWithFacebook(fbAccessToken);
    await handleAuthResponse(res);
  }

  async function registerWithEmail(
    email: string,
    password: string,
    displayName: string,
  ): Promise<void> {
    const res = await authApi.register(email, password, displayName);
    await handleAuthResponse(res);
  }

  function continueAsGuest(): void {
    setAuth({
      userId: null,
      displayName: null,
      email: null,
      avatarUrl: null,
      isGuest: true,
      isLoading: false,
    });
  }

  async function doLogout(): Promise<void> {
    // Best-effort: call backend logout; ignore network errors
    try {
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();
      if (accessToken && refreshToken) {
        await authApi.logout(accessToken, refreshToken);
      }
    } catch {
      // ignore
    }
    await clearTokens();
    setAccessToken(null);
    setRefreshToken(null);
    setAuth({
      userId: null,
      displayName: null,
      email: null,
      avatarUrl: null,
      isGuest: false,
      isLoading: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Provider
  // ---------------------------------------------------------------------------

  const value: AuthContextValue = {
    auth,
    signInWithEmail,
    signInWithGoogle,
    signInWithFacebook,
    registerWithEmail,
    continueAsGuest,
    logout: doLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
