const fs = require('fs');
const path = require('path');

const petDir = path.join(__dirname, '../../assets/pets');
const images = Object.fromEntries(
  fs
    .readdirSync(petDir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => [`pet_${f.replace('.png', '')}`, `../../assets/pets/${f}`]),
);

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch-widget',
  name: 'SproutlingComplications',
  displayName: 'Sproutling',
  bundleIdentifier: '.watchkitapp.complications',
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: { $accent: '#5BE3A8' },
  images,
  entitlements: {
    'com.apple.security.application-groups': ['group.com.sproutlingapp.sproutling.watch'],
  },
};
