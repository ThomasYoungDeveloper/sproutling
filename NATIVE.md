# Sproutling phone app: build plan

The web app at sproutling.vercel.app is the same code that becomes the iPhone and Android apps (Expo).

## What's ready

- App identifiers: `com.sproutlingapp.sproutling` (iOS bundle ID and Android package). Change these before the first build if you'd like a different one; they can't change after the app is in the stores.
- Build profiles in `eas.json`: `development` (test build with dev tools), `preview` (share with testers), `production` (App Store / Play Store).
- Health permission text for iOS in `app.json`.
- `src/lib/health.ts`: one place the game reads steps and sleep from. On the web it stays manual; the phone build plugs in the native readers here.

## What Tom needs to do (one time)

1. Apple Developer account: done.
2. Create a free Expo account at https://expo.dev (this builds the app in the cloud, no Mac needed).
3. Google Play developer account ($25 one-time) when we're ready for Android.

## First iPhone build (we do this together)

1. Install the health libraries (only work in a real phone build, not Expo Go):
   - iOS: `@kingstinct/react-native-healthkit` (with its Expo config plugin)
   - Android: `react-native-health-connect` v4 (config plugin included; needs `minSdkVersion` 26 via `expo-build-properties`)
2. Fill in the native providers in `src/lib/health.ts` (steps and sleep for a day).
3. Run `npx eas-cli@latest build --profile preview --platform ios` and sign in with the Expo account; EAS asks to log in to Apple and creates the certificates.
4. Install on your iPhone through TestFlight (`npx eas-cli@latest submit --platform ios`).

## Later

- Push notifications (egg ready, pet hungry, guild goal reached) with `expo-notifications`.
- Native sound effects with `expo-audio` (the web version synthesizes sounds in the browser).
- In-app purchases for Premium through Apple and Google (RevenueCat is the usual choice); Stripe for the web.
