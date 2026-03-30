/**
 * Environment configuration
 *
 *   'local' → http://10.0.2.2:3000                      (Android emulator localhost)
 *   'dev'   → https://bi-backend-dev.azurewebsites.net  (Azure dev — used for all builds)
 *   'prod'  → https://bi-backend-prod.azurewebsites.net (Azure prod — future)
 */

type Env = 'local' | 'dev' | 'prod';

const URLS: Record<Env, string> = {
  local: 'http://10.0.2.2:3000',
  dev:   'https://bi-backend-dev.azurewebsites.net',
  prod:  'https://bi-backend-prod.azurewebsites.net',
};

// Both debug and release builds target the Azure dev backend
const DEBUG_ENV: Env = 'dev';
const RELEASE_ENV: Env = 'dev';

export const API_BASE_URL = __DEV__ ? URLS[DEBUG_ENV] : URLS[RELEASE_ENV];

// Google OAuth web client ID — used by the backend to verify Google ID tokens.
// Not a secret; safe to commit. The Android client ID is in google-services.json.
export const GOOGLE_WEB_CLIENT_ID = '818552283324-1gjieq3e2bq6iv1kcirqqpngctbl5aqi.apps.googleusercontent.com';
