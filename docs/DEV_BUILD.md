# Kirana — development build (push + full native features)

Expo Go is fine for OTP and most UI. **Remote push** and some native features need a **development build** (your own Kirana app with `expo-dev-client`).

EAS project: [expo.dev/accounts/jackdev007/projects/kirana](https://expo.dev/accounts/jackdev007/projects/kirana)  
Project ID is in `app.json` → `extra.eas.projectId`.

## Option A — EAS cloud build (easiest on Android, no Android Studio)

On your Mac (Node 22):

```bash
cd ~/Desktop/kirana
nvm use 22
npx eas-cli login   # if needed
npx eas-cli build --platform android --profile development
```

When the build finishes, open the link from the CLI (or the Expo dashboard) and **install the APK** on your phone (allow install from browser / unknown sources if prompted).

Start JS bundler:

```bash
npx expo start
```

Open the **Kirana** dev app (not Expo Go) → connect to Metro → log in. Push tokens will register using the EAS project ID.

## Option B — Local build (USB Android + Android Studio)

```bash
nvm use 22
npx expo run:android --device
```

First run downloads Gradle and can take a while. Phone: enable **USB debugging**, plug in, accept the prompt.

## After install

| Use | Don’t use |
|-----|-----------|
| Kirana dev client from the build | Expo Go for push testing |
| `npx expo start` | — |

Rebuild the native app only when you add native libraries or change `app.json` plugins.

## Production later

```bash
npx eas-cli build --platform android --profile production
```
