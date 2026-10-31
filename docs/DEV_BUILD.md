# Kirana — run on Android + iPhone (one Metro, both devices)

## How it actually works

**One command on your Mac** starts **Metro** (the JavaScript bundler):

```bash
cd ~/Desktop/kirana
nvm use 24
npx expo start
```

**Android and iOS both load the same app from that Metro server.**  
There is no separate “Android from Metro, iOS from Expo” — Expo **is** Metro + the native shell on each phone.

| Piece | Role |
|--------|------|
| **Metro** (`npx expo start`) | Serves your React Native code to **every** connected device |
| **Native app on the phone** | Kirana **development build** (or simulator/emulator) — opens once, then talks to Metro |

Install the native **Kirana dev client** once per platform; after that you only run `npx expo start` for daily work.

---

## Step 1 — Install the Kirana dev app (once per platform)

**Android:** EAS development APK — [project builds](https://expo.dev/accounts/jackdev007/projects/kirana/builds)  
(or `npx eas-cli build --platform android --profile development`)

**iPhone:** EAS development build for device — requires Apple Developer for real device:

```bash
npx eas-cli build --platform ios --profile development
```

**Or on Mac with Xcode:**

```bash
npx expo run:ios --device    # iPhone
npx expo run:android --device # Android USB
```

**iOS Simulator only (Mac):**

```bash
npx expo run:ios
```

Expo Go can open the project for quick UI tests, but **push and full native behavior** match production only in the **dev build** (`expo-dev-client`).

---

## Step 2 — Run both devices from the same Metro

```bash
nvm use 24
npx expo start
```

Then connect **each** device to **this same terminal session**:

| Device | How to connect |
|--------|----------------|
| **Android phone** | Open installed **Kirana** app → scan QR / pick project from dev menu |
| **iPhone** | Open installed **Kirana** app → same |
| **Android emulator** | Press **`a`** in the Metro terminal (needs Android Studio emulator running) |
| **iOS Simulator** | Press **`i`** in the Metro terminal (needs Xcode) |

Same Wi‑Fi as the Mac, or:

```bash
npx expo start --tunnel
```

You can have **Android + iPhone connected at the same time** — both reload when you save code (`r` in terminal or shake → Reload).

---

## When to rebuild the native app

Rebuild (EAS or `expo run:ios` / `expo run:android`) only when you:

- Add a library with **native code**
- Change **`app.json` plugins**
- Upgrade **Expo SDK**

Pure TypeScript/UI changes → **Metro only**, no rebuild.

---

## EAS project

[expo.dev/accounts/jackdev007/projects/kirana](https://expo.dev/accounts/jackdev007/projects/kirana)  
`app.json` → `extra.eas.projectId` (push tokens).

## Production later

```bash
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```
