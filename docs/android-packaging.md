# Android APK Packaging Guide

This document covers how to build debug and release APKs for the Behavioral Intelligence Android app.

---

## What changed since the last APK

The following significant features have been added since `versionCode 2`:

| Area | What was added |
|------|---------------|
| Auth | Email/password registration + login |
| Auth | Google Sign-In (Android native) |
| Auth | Facebook Login (Android native) |
| Auth | JWT + refresh token management, SecureStore |
| Profile | Multi-occupation selection, country, life stage |
| Games | Game catalog expanded; cognitive signal depth improvements |
| Sessions | Persistent session IDs, back-button lock during assessment |
| Report | Progress summary for returning users (trait history) |
| Backend | Azure deployment, rate limiting, LLM caching |

`versionCode` has been bumped to **3**, `versionName` to **1.1.0**.

---

## Prerequisites (one-time setup on build machine)

### 1. Android SDK
Install Android Studio and ensure these SDK components are installed:
- Android SDK Platform 34 (`compileSdkVersion 34`)
- Android SDK Build-Tools 34.0.0
- NDK 25.1.8937393

### 2. `local.properties`
Create `mobile/android/local.properties` from the example file:

```powershell
cp mobile\android\local.properties.example mobile\android\local.properties
```

Then edit it and fill in:
- **`sdk.dir`** — path to your Android SDK, e.g. `C\:\\Users\\YourName\\AppData\\Local\\Android\\Sdk`
- **`FACEBOOK_APP_ID`** — `1655685855631376` (App: Behavioral Intelligence)
- **`FACEBOOK_CLIENT_TOKEN`** — from Facebook Developer Console → Your App → Settings → Advanced → Client token

### 3. Release signing (`~/.gradle/gradle.properties`)
For **release builds only**. The file `~/.gradle/gradle.properties` must contain:

```properties
BI_STORE_FILE=behavioral-intelligence.keystore
BI_STORE_PASSWORD=<keystore password>
BI_KEY_ALIAS=bi-key
BI_KEY_PASSWORD=<key password>
```

The keystore file (`mobile/android/app/behavioral-intelligence.keystore`) is gitignored.
It must be present on the build machine. Copy it from secure storage if building on a new machine.

### 4. `google-services.json`
The file `mobile/android/app/google-services.json` is gitignored. It must be present for Google Sign-In to work.
Download it from Firebase Console → Project Settings → Android app → Download `google-services.json`.

**Important:** The SHA-1 fingerprint of the signing key must be registered in both Firebase and GCP.
See `docs/social-auth-integration-guide.md` for details.

---

## Building a debug APK (for emulator or USB-connected device)

> **Note:** Debug builds use `DEBUG_ENV` from `mobile/src/config.ts`.
> The committed default is `'local'` → hits `http://10.0.2.2:3000` (emulator localhost).
> To test on a **real device** against the Azure backend, temporarily change `DEBUG_ENV` to `'dev'`
> before building (do not commit this change).

```powershell
cd mobile
npm run build:android:debug
# or directly:
cd android && .\gradlew assembleDebug
```

Output: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

Install on a connected device:
```powershell
adb install mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## Building a release APK (for distribution / real-device testing)

Release builds always use `RELEASE_ENV = 'dev'` (Azure backend) — no config change needed.
Requires `~/.gradle/gradle.properties` with signing credentials (see prerequisites above).

```powershell
cd mobile
npm run build:android:release
# or directly:
cd android && .\gradlew assembleRelease
```

Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`

The release APK is signed with the `behavioral-intelligence.keystore` key.
Distribute via direct install (`adb install`) or upload to Firebase App Distribution / Google Play.

---

## Cleaning the build cache

If you hit Gradle errors, clean before rebuilding:

```powershell
cd mobile
npm run build:android:clean
# then rebuild
npm run build:android:release
```

---

## SHA-1 fingerprints

The app has two signing keys, each with a different SHA-1 that must be registered in Firebase and GCP.

### Debug key (for development)
**Keystore:** `mobile/android/app/debug.keystore` (committed)

```powershell
keytool -list -v -keystore mobile\android\app\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### Release key
**Keystore:** `mobile/android/app/behavioral-intelligence.keystore` (gitignored — get from secure storage)

```powershell
keytool -list -v -keystore mobile\android\app\behavioral-intelligence.keystore -alias bi-key -storepass <password>
```

If Google Sign-In fails with error code 10, the SHA-1 fingerprint of the key used to sign that build is not registered.
See `docs/social-auth-integration-guide.md` → Troubleshooting section for the full fix procedure.

---

## Backend URLs

| Build type | Backend |
|-----------|---------|
| Debug (`DEBUG_ENV='local'`) | `http://10.0.2.2:3000` — emulator localhost |
| Debug (`DEBUG_ENV='dev'`) | `https://bi-backend-dev.azurewebsites.net` |
| Release | `https://bi-backend-dev.azurewebsites.net` (always) |

To switch the debug backend, edit `mobile/src/config.ts` → `DEBUG_ENV`. Do not commit the change.

---

## App identifiers

| Field | Value |
|-------|-------|
| Application ID | `com.behavioralintelligence` |
| Version code | 3 |
| Version name | 1.1.0 |
| Min SDK | 21 (Android 5.0) |
| Target SDK | 34 (Android 14) |
| Facebook App ID | 1655685855631376 |
