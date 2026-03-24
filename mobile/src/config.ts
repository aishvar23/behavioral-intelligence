/**
 * Environment configuration
 *
 * To test against a different backend during local development,
 * change DEBUG_ENV below. This file is committed — do not commit
 * your local change to DEBUG_ENV.
 *
 *   'local' → http://10.0.2.2:3000                      (local backend)
 *   'dev'   → https://bi-backend-dev.azurewebsites.net  (Azure dev)
 *   'prod'  → https://bi-backend-prod.azurewebsites.net (Azure prod)
 */

type Env = 'local' | 'dev' | 'prod';

const URLS: Record<Env, string> = {
  local: 'http://10.0.2.2:3000',
  dev:   'https://bi-backend-dev.azurewebsites.net',
  prod:  'https://bi-backend-prod.azurewebsites.net',
};

// Change this to switch backend during debug builds
const DEBUG_ENV: Env = 'local';

// Release builds always hit dev until prod backend is provisioned
const RELEASE_ENV: Env = 'dev';

export const API_BASE_URL = __DEV__ ? URLS[DEBUG_ENV] : URLS[RELEASE_ENV];

// Google OAuth web client ID — used by the backend to verify Google ID tokens.
// Not a secret; safe to commit. The Android client ID is in google-services.json.
export const GOOGLE_WEB_CLIENT_ID = '818552283324-1gjieq3e2bq6iv1kcirqqpngctbl5aqi.apps.googleusercontent.com';
