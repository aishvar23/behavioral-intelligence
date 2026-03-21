# Auth — Frontend Design

## Overview

Add an auth flow to the React Native mobile app so users can sign in with Google, Facebook, or email/password before starting an assessment. Authenticated users get persistent trait history across sessions. The guest path ("No account needed") continues to work as today.

---

## Auth Strategy

| Concern | Decision | Rationale |
|---------|----------|-----------|
| State management | React Context (`AuthContext`) | Lightweight, no Redux needed |
| Token storage | `expo-secure-store` | Hardware-backed keystore on device; falls back to encrypted SharedPrefs |
| Social sign-in SDK | `expo-auth-session` / `@react-native-google-signin/google-signin` for Google; `react-native-fbsdk-next` for Facebook | Standard Expo/RN approach |
| Axios auth | Request interceptor attaches `Authorization: Bearer <accessToken>` | Transparent to all existing API calls |
| Token refresh | Response interceptor catches 401, refreshes once, retries original request | Handles expiry silently |
| Logout | Clears tokens from SecureStore, resets navigation to Auth stack | |

---

## New Dependencies

```json
"expo-secure-store": "~13.0.0",
"@react-native-google-signin/google-signin": "^12.0.0",
"react-native-fbsdk-next": "^13.0.0"
```

> Facebook SDK requires native build config (`android/app/src/main/res/values/strings.xml` entry + `AndroidManifest.xml` metadata). Documented in the plan.

---

## New Screens

### `AuthScreen`
Entry point for unauthenticated users. Shown before the current `Home` screen.

**UI elements**
- App logo + tagline (same as current `HomeScreen` hero)
- "Continue with Google" button (Google branded)
- "Continue with Facebook" button (Facebook branded)
- "Sign in with Email" button
- "Continue as Guest" link — skips auth, enters existing flow

**Behaviour**
- Google / Facebook buttons trigger social sign-in SDK, then POST `/auth/google` or `/auth/facebook`
- "Sign in with Email" navigates to `LoginScreen`
- "Continue as Guest" navigates to `OccupationIntent` with `userId = undefined`

---

### `LoginScreen`
Email + password sign-in.

**UI elements**
- Email text input (keyboard type: `email-address`)
- Password input (secureTextEntry)
- "Sign In" button
- "Create an account" link → `RegisterScreen`
- "Back" → `AuthScreen`

**Behaviour**
- POST `/auth/login`
- On success: save tokens, navigate to `Home`
- On 401: show inline error "Incorrect email or password"

---

### `RegisterScreen`
New account creation.

**UI elements**
- Display name input
- Email input
- Password input (min 8 chars, show strength hint)
- "Create Account" button
- "Already have an account?" link → `LoginScreen`

**Behaviour**
- POST `/auth/register`
- On success: save tokens, navigate to `Home`
- On 409 (email in use): "An account with this email already exists"
- On 400 (validation): show field-level error

---

## New Context: `AuthContext`

```typescript
interface AuthState {
  userId: number | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
}

interface AuthContextValue {
  auth: AuthState;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
}
```

`AuthProvider` wraps the entire `NavigationContainer`.

On app start, `AuthProvider` reads tokens from SecureStore:
- If valid access token (or refreshable) → restore session, skip `AuthScreen`
- Otherwise → show `AuthScreen`

---

## Token Storage (SecureStore keys)

| Key | Value |
|-----|-------|
| `bi_access_token` | Raw JWT access token |
| `bi_refresh_token` | Raw JWT refresh token |
| `bi_user_json` | Serialised `AuthState` (userId, displayName, email, avatarUrl) |

---

## Axios Interceptors (in `services/api.ts`)

### Request interceptor
```typescript
api.interceptors.request.use(config => {
  const token = getAccessToken(); // read from memory (not SecureStore — async not needed)
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Tokens are held in a module-level variable after being read from SecureStore at app startup. No async needed per-request.

### Response interceptor (refresh on 401)
```typescript
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      await refreshAccessToken();        // POST /auth/refresh
      err.config.headers.Authorization = `Bearer ${getAccessToken()}`;
      return api(err.config);            // retry original request once
    }
    return Promise.reject(err);
  }
);
```

---

## Navigation Changes

### New stack: `AuthStack`

```
AuthStack
  ├── Auth       (AuthScreen)
  ├── Login      (LoginScreen)
  └── Register   (RegisterScreen)
```

### Updated `AppNavigator`

```
Root Navigator
  ├── AuthStack   (shown when not authenticated)
  └── AppStack    (shown when authenticated OR guest)
        ├── Home
        ├── OccupationIntent
        ├── UserProfile
        ├── Game
        └── Report
```

`AppNavigator` reads from `AuthContext` to decide which stack to show.

The `useEffect(() => { initSession(); }, [])` stays in `AppNavigator` — session is initialised regardless of auth state.

---

## Changes to Existing Screens

### `HomeScreen`
No change — still the entry into the assessment flow.
The "No account needed" note can stay (guest flow still works).

### `UserProfileScreen`
No change needed. `userId` already flows through navigation params optionally. `AuthContext` provides `userId` which is passed when navigating to `Game` and `Report`.

The navigation call in `UserProfileScreen` that pushes to `Game` currently has `userId` from `registerUser()`. After auth, it reads from `AuthContext.auth.userId` instead (guest path: `undefined`).

> **Key change**: Remove the call to `registerUser()` (POST `/user`) from `UserProfileScreen` for authenticated users — the backend already has their record. Keep it for guest users.

### `GameScreen`
No change — already accepts `userId?: number` from params.

### `ReportScreen`
No change — already accepts `userId?: number` from params.

---

## Environment / Config

Add to `mobile/src/config.ts`:
```typescript
export const GOOGLE_CLIENT_ID = '<Google OAuth client ID for Android/iOS>';
```

Google Client ID is NOT a secret — it is public and specific to each platform (Android vs iOS). The real secret (`client_secret`) never leaves the backend.

---

## Security Notes

- Tokens stored in `expo-secure-store` (Android Keystore / iOS Keychain) — not `AsyncStorage`
- Access token held in memory once read; never logged or serialised to plain storage after initial read
- Refresh token only sent to `/auth/refresh` — never attached to game API calls
- Social ID tokens sent to our backend for server-side verification — client never accesses profile data directly
- On logout, all SecureStore keys are deleted and in-memory token is cleared

---

## Guest vs Authenticated comparison

| Capability | Guest | Authenticated |
|------------|-------|---------------|
| Take assessment | Yes | Yes |
| Get career report | Yes | Yes |
| Trait history across sessions | No | Yes |
| Progress summary in report | No | Yes (shows improvement) |
| Persistent userId | No | Yes |
