#!/usr/bin/env bash
# Sproutling: send the latest app code to everyone's phones as a live update (no new build needed).
# Works for app-code changes. Native changes (widgets, Health access, new native packages) still need a build:
# Claude will say which one each change needs.
# Run from Terminal on a Mac:
#   bash <(curl -fsSL https://raw.githubusercontent.com/ThomasYoungDeveloper/sproutling/main/scripts/send-update.sh)
set -euo pipefail

APP_DIR="$HOME/Sproutling"
ZIP_URL="https://codeload.github.com/ThomasYoungDeveloper/sproutling/zip/refs/heads/main"
EAS="npx --yes eas-cli@latest"
export EAS_NO_VCS=1

bold() { printf "\n\033[1m%s\033[0m\n" "$1"; }
step() { printf "\n\033[1;32m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✖ %s\033[0m\n" "$1"; exit 1; }

bold "🌱 Send a Sproutling live update"
echo "This sends the newest app code to every phone with the latest TestFlight build. It takes about 2 minutes."

# A Desktop shortcut for next time (double-click to run).
SHORTCUT="$HOME/Desktop/Send Sproutling Update.command"
if [ ! -f "$SHORTCUT" ]; then
  printf '#!/bin/bash\nbash <(curl -fsSL https://raw.githubusercontent.com/ThomasYoungDeveloper/sproutling/main/scripts/send-update.sh)\necho\nread -n 1 -s -r -p "Press any key to close this window."\n' > "$SHORTCUT"
  chmod +x "$SHORTCUT"
  echo "Added \"Send Sproutling Update\" to your Desktop for next time."
fi

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

step "Installing packages"
npm install --no-audit --no-fund --loglevel=error

step "Signing in to Expo"
if $EAS whoami >/dev/null 2>&1; then
  echo "Signed in as $($EAS whoami 2>/dev/null | head -1) ✓"
else
  echo "Enter your Expo email (or username) and password:"
  $EAS login
fi

MSG=$(node -e 'try{const n=require("./release-note.json");console.log(n.message||"")}catch{console.log("")}')
[ -z "$MSG" ] && MSG="Update $(date '+%b %d %H:%M')"

step "Sending the update"
echo "Message: $MSG"
$EAS update --channel production --platform ios --message "$MSG" --non-interactive

bold "🎉 Sent!"
cat <<'TXT'
Phones get it the next time Sproutling opens or comes back to the front (it may need to be opened twice).
Only phones on a build with live updates (the next build you run, or newer) can receive it.
TXT
