# Sproutling phone app: build plan

The web app at sproutling.vercel.app is the same code that becomes the iPhone and Android apps (Expo).

## What's ready

- App identifiers: `com.sproutlingapp.sproutling` (iOS bundle ID and Android package). Change these before the first build if you'd like a different one; they can't change after the app is in the stores.
- Build profiles in `eas.json`: `development` (test build with dev tools), `preview` (share with testers), `production` (App Store / Play Store).
- Health permission text for iOS in `app.json`.
- `src/lib/health.ts`: one place the game reads steps and sleep from. On the web it stays manual; the phone build plugs in the native readers here.

## Accounts

1. Apple Developer account: done.
2. Expo account: done.
3. Google Play developer account ($25 one-time) when we're ready for Android.

## Apple Health: done in code

- `@kingstinct/react-native-healthkit` is installed with its config plugin in `app.json` (read-only access to steps and sleep, no background delivery).
- `src/lib/healthNative.ios.ts` reads today's steps (midnight to midnight, iPhone + Watch merged) and last night's sleep (6 pm to noon, only "asleep" stages, overlaps merged).
- `src/lib/useHealthSync.ts` syncs when the app opens, when it comes back to the front, and every 5 minutes. Steps only go up; sleep uses the verified number.
- The web version stays manual (`src/lib/healthNative.ts`).

## First iPhone build (run on your own computer)

You need Node.js 20 or newer (https://nodejs.org) and git. EAS builds in the cloud, so no Mac or Xcode is needed.

```bash
git clone https://github.com/ThomasYoungDeveloper/sproutling.git
cd sproutling
npm install
npx eas-cli@latest login                 # your Expo account
npx eas-cli@latest init                  # links the project to your Expo account (adds a projectId to app.json)
npx eas-cli@latest build --platform ios --profile production
```

During the build command, answer yes when it offers to log in to your Apple account and to create the certificates and provisioning profile. It also turns on the HealthKit capability for the app ID. The build runs in Expo's cloud (about 15–25 minutes) and you get a link when it's done.

Then send it to TestFlight:

```bash
npx eas-cli@latest submit --platform ios --latest
```

This uploads to App Store Connect (it can create the app record for you). Apple takes about 10–30 minutes to process it. Then install the TestFlight app on your iPhone, open it, and install Sproutling. Your account in App Store Connect is automatically an internal tester.

After `eas init`, commit and push the `app.json` change (or tell Claude the projectId) so future builds use the same project.

## Later

- Push notifications (egg ready, pet hungry, guild goal reached) with `expo-notifications`.
- Native sound effects with `expo-audio` (the web version synthesizes sounds in the browser).
- In-app purchases for Premium through Apple and Google (RevenueCat is the usual choice); Stripe for the web.
