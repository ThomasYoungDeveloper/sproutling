const fs = require('fs');
const path = require('path');

// Every sprite's art, so the watch can show whichever one is active.
const petDir = path.join(__dirname, '../../assets/pets');
const images = Object.fromEntries(
  fs
    .readdirSync(petDir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => [`pet_${f.replace('.png', '')}`, `../../assets/pets/${f}`]),
);

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'SproutlingWatch',
  displayName: 'Sproutling',
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '10.0',
  icon: '../../assets/icon.png',
  frameworks: ['SwiftUI', 'WatchConnectivity', 'HealthKit', 'WidgetKit'],
  colors: { $accent: '#5BE3A8' },
  images,
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.access': [],
    'com.apple.security.application-groups': ['group.com.sproutlingapp.sproutling.watch'],
  },
};
