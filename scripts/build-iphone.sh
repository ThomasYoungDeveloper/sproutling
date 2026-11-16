#!/usr/bin/env bash
# Sproutling: build the iPhone app and send it to TestFlight.
# Run from Terminal on a Mac:
#   bash <(curl -fsSL https://raw.githubusercontent.com/ThomasYoungDeveloper/sproutling/main/scripts/build-iphone.sh)
set -euo pipefail

APP_DIR="$HOME/Sproutling"
ZIP_URL="https://codeload.github.com/ThomasYoungDeveloper/sproutling/zip/refs/heads/main"
EAS="npx --yes eas-cli@latest"

bold() { printf "\n\033[1m%s\033[0m\n" "$1"; }
step() { printf "\n\033[1;32m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✖ %s\033[0m\n" "$1"; exit 1; }

bold "🌱 Sproutling iPhone build"
echo "This sets up the project in $APP_DIR, builds the iPhone app in Expo's cloud, and sends it to TestFlight."
echo "You'll be asked to sign in to Expo and to your Apple Developer account. Type your answers right here in Terminal."

# 1. Node.js
step "Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed. Opening the download page: install the LTS version, then run this command again."
  open "https://nodejs.org/en/download" || true
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "You have Node.js $(node -v), but version 20 or newer is needed. Opening the download page."
  open "https://nodejs.org/en/download" || true
  exit 1
fi
echo "Node.js $(node -v) ✓"

# 2. Project files (keeps the Expo project link from an earlier run)
step "Getting the latest Sproutling code"
OLD_ID=""
if [ -f "$APP_DIR/app.json" ]; then
  OLD_ID=$(node -e 'try{const c=require(process.argv[1]);console.log(c.expo?.extra?.eas?.projectId||"")}catch{console.log("")}' "$APP_DIR/app.json")
fi
TMP=$(mktemp -d)
curl -fsSL "$ZIP_URL" -o "$TMP/sproutling.zip" || fail "Couldn't download the code. Check your internet connection and try again."
unzip -q "$TMP/sproutling.zip" -d "$TMP"
mkdir -p "$APP_DIR"
rsync -a --exclude node_modules "$TMP"/sproutling-main/ "$APP_DIR"/
rm -rf "$TMP"
cd "$APP_DIR"
echo "Code is in $APP_DIR ✓"

step "Installing packages (this can take a few minutes the first time)"
npm install --no-audit --no-fund --loglevel=error

# 3. Expo account
step "Signing in to Expo"
if $EAS whoami >/dev/null 2>&1; then
  echo "Signed in as $($EAS whoami 2>/dev/null | head -1) ✓"
else
  echo "Enter your Expo email (or username) and password:"
  $EAS login
fi

# 4. Link the project to your Expo account
step "Linking the project to your Expo account"
NEW_ID=$(node -e 'const c=require("./app.json");console.log(c.expo?.extra?.eas?.projectId||"")')
if [ -z "$NEW_ID" ] && [ -n "$OLD_ID" ]; then
  $EAS init --id "$OLD_ID" --non-interactive --force
elif [ -z "$NEW_ID" ]; then
  echo "If it asks to create a project, answer Y (yes)."
  $EAS init
fi
PROJECT_ID=$(node -e 'const c=require("./app.json");console.log(c.expo?.extra?.eas?.projectId||"")')
echo "Project ID: $PROJECT_ID ✓"

# 5. Build in the cloud
step "Building the iPhone app in Expo's cloud"
cat <<'TXT'
Answer the questions like this:
  • "Do you want to log in to your Apple account?"            → Y, then your Apple ID email, password and the 6-digit code
  • "Generate a new Apple Distribution Certificate?"           → Y
  • "Generate a new Apple Provisioning Profile?"               → Y
  • Anything about push notifications                          → N (not yet)
The build itself takes about 15–25 minutes. You can watch it at the link it prints.
TXT
$EAS build --platform ios --profile production

# 6. Send to TestFlight
step "Sending the build to TestFlight"
echo "If it asks to log in to Apple again, use the same Apple ID. If it asks to create the app in App Store Connect, answer Y."
$EAS submit --platform ios --latest

bold "🎉 Done!"
cat <<TXT
Apple now processes the build (usually 10–30 minutes). Then:
  1. Install the "TestFlight" app from the App Store on your iPhone.
  2. Open it (same Apple ID) and install Sproutling.
  3. When Sproutling asks for Apple Health access, turn on Steps and Sleep.

Send Claude this project ID so future builds stay linked: $PROJECT_ID
TXT
printf "%s" "$PROJECT_ID" | pbcopy 2>/dev/null && echo "(It's already copied to your clipboard.)"
