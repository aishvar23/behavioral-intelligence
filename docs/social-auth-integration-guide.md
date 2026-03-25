# Social Auth Integration Guide — Google & Facebook (Android)

This guide documents the end-to-end setup for Google Sign-In and Facebook Login on Android in a **bare React Native** project with Expo modules.

---

## Architecture Overview

```
Mobile App
  └─ Native SDK (Google/Facebook)
       └─ Provider token (idToken / accessToken)
            └─ POST /auth/google or /auth/facebook
                 └─ Backend verifies with provider API
                      └─ Issues our own JWT (access + refresh)
                           └─ Stored in SecureStore
```

The mobile app never stores the provider token long-term — only our own JWTs.

---

## Google Sign-In

### 1. Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use existing) — name: **"Behavioral Intelligence"**
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**

**Android client** (used by the native SDK):
- Application type: **Android**
- Name: `Behavioral Intelligence Android`
- Package name: `com.behavioralintelligence`
- SHA-1: get from debug keystore (see below)

**Web client** (used by backend to verify ID tokens):
- Application type: **Web application**
- Name: `Behavioral Intelligence Web`
- No redirect URIs needed

#### Get SHA-1 fingerprint

If the debug keystore doesn't exist yet, generate it:
```powershell
keytool -genkey -v -keystore "C:\Users\<USER>\.android\debug.keystore" -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"
```

Then get the SHA-1:
```powershell
keytool -keystore "C:\Users\<USER>\.android\debug.keystore" -list -v -alias androiddebugkey -storepass android -keypass android
```

Copy the **SHA-1** line from the output.

### 2. Firebase (for google-services.json)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project → Add Firebase to a Google Cloud project** → select existing project
3. **Add app → Android**
   - Package name: `com.behavioralintelligence`
   - SHA-1: paste from above
4. Download `google-services.json` → place at `mobile/android/app/google-services.json`

> `google-services.json` is safe to commit — it contains no secrets, only client-side config.

### 3. Android build config

**`android/build.gradle`** — add to `buildscript.dependencies`:
```groovy
classpath("com.google.gms:google-services:4.4.2")
```

**`android/app/build.gradle`** — add at the bottom:
```groovy
apply plugin: 'com.google.gms.google-services'
```

### 4. Mobile package

```bash
npm install @react-native-google-signin/google-signin
```

**`src/config.ts`**:
```ts
export const GOOGLE_WEB_CLIENT_ID = '<your-web-client-id>.apps.googleusercontent.com';
```

**`AuthContext.tsx`** — configure on mount:
```ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
```

**Sign-in flow**:
```ts
await GoogleSignin.hasPlayServices();
const userInfo = await GoogleSignin.signIn();
const idToken = userInfo.data?.idToken;
// send idToken to POST /auth/google
```

### 5. Backend

Environment variable: `GOOGLE_CLIENT_ID=<web-client-id>`

The backend verifies the ID token using `google-auth-library`:
```ts
const client = new OAuth2Client(clientId);
const ticket = await client.verifyIdToken({ idToken, audience: clientId });
```

---

## Facebook Login

### 1. Meta Developer Console

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. **My Apps → Create App**
   - Use case: **Authenticate and request data from users with Facebook Login**
   - App name: `Behavioral Intelligence`
3. From **App Settings → Basic**, collect:
   - **App ID**
   - **App Secret** (click Show)
4. From **App Settings → Advanced → Security**, collect:
   - **Client Token**

### 2. Register Android platform

**App Settings → Basic → Add Platform → Android**:
- Package name: `com.behavioralintelligence`
- Class name: `com.behavioralintelligence.MainActivity`
- Key hash: compute from your debug keystore certificate:

```powershell
# Export PEM certificate
keytool -exportcert -alias androiddebugkey -keystore "C:\Users\<USER>\.android\debug.keystore" -storepass android -rfc
```

Then compute the base64 SHA-1 hash (Linux/Mac):
```bash
echo "<base64-cert-body-without-headers>" | base64 -d | openssl sha1 -binary | base64
```

> **Note:** Meta may show "package name verification failed" — ignore it and save anyway. Development mode works without verified package name.

### 3. Development mode

In development mode, Facebook Login only works for users explicitly added as:
- **Admins / Developers / Testers** on the app

To add test users: **App Roles → Roles → Add Testers**

App Review and business verification are only required before going **public**.

### 4. Android config

**`android/app/src/main/res/values/strings.xml`**:
```xml
<resources>
    <string name="app_name">Behavioral Intelligence</string>
    <string name="facebook_app_id">YOUR_APP_ID</string>
    <string name="facebook_client_token">YOUR_CLIENT_TOKEN</string>
</resources>
```

**`android/app/src/main/AndroidManifest.xml`** — inside `<application>`:
```xml
<meta-data android:name="com.facebook.sdk.ApplicationId" android:value="@string/facebook_app_id"/>
<meta-data android:name="com.facebook.sdk.ClientToken" android:value="@string/facebook_client_token"/>

<activity android:name="com.facebook.FacebookActivity"
  android:configChanges="keyboard|keyboardHidden|screenLayout|screenSize|orientation"
  android:label="@string/app_name" />
<activity
  android:name="com.facebook.CustomTabActivity"
  android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="fbYOUR_APP_ID" android:host="authorize" />
  </intent-filter>
</activity>
```

### 5. Mobile package

```bash
npm install react-native-fbsdk-next
```

**Sign-in flow**:
```ts
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';

const result = await LoginManager.logInWithPermissions(['public_profile']);
if (result.isCancelled) return;
const data = await AccessToken.getCurrentAccessToken();
// send data.accessToken to POST /auth/facebook
```

> **Note:** `email` permission requires App Review approval. `public_profile` (name + Facebook ID) is sufficient for account creation and available in development mode.

### 6. Backend

Environment variables:
```
FACEBOOK_APP_ID=YOUR_APP_ID
FACEBOOK_APP_SECRET=YOUR_APP_SECRET
```

The backend verifies the access token via Facebook Graph API:
```
GET https://graph.facebook.com/me?fields=id,name,email,picture&access_token=TOKEN
```

---

## Account Linking

If the same email address is used across Google, Facebook, and email/password, the backend's `upsertSocialUser()` function automatically links them to the same `userId`. The user ends up with one account regardless of which provider they used.

See `backend/src/services/auth.ts → upsertSocialUser` for implementation.

---

## Environment Variables Reference

| Variable | Where to get it |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Web OAuth Client ID |
| `FACEBOOK_APP_ID` | Meta Developer Console → App Settings → Basic |
| `FACEBOOK_APP_SECRET` | Meta Developer Console → App Settings → Basic → Show |
| `JWT_ACCESS_SECRET` | Generate randomly: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Generate randomly: `openssl rand -hex 32` |

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `expo-modules-core.gradle does not exist` | Wrong gradle script path | Use `../android/ExpoModulesCorePlugin.gradle` not `../scripts/android/...` |
| `Invalid App ID` | Wrong Facebook App ID | Verify exact ID from Meta Console (count digits carefully) |
| `Given URL is not allowed` | Android platform not registered in Meta Console | Add Android platform in App Settings → Basic |
| `Invalid Scope: email` | Email permission not approved | Remove `email` from permissions or add it via Use Cases in Meta Console |
| `Unable to load script` | Metro not connected | Use `npx react-native run-android` not `expo start --dev-client` for bare RN |
| `Could not read script .gradle` | Expo SDK version mismatch | Pin expo packages to SDK 50: `expo ~50.0.0`, `expo-modules-core ~1.11.0` |
