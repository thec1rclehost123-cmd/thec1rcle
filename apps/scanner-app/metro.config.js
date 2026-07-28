/* eslint-env node */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Exclude Next.js and build folders of other workspaces from Metro to prevent watcher crashes
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
}
config.resolver.blockList.push(
  /[\\/]apps[\\/]partner-dashboard[\\/]\.next[\\/]/,
  /[\\/]apps[\\/]guest-portal[\\/]\.next[\\/]/,
  /[\\/]apps[\\/]admin-console[\\/]\.next[\\/]/,
  /[\\/]apps[\\/]partner-dashboard[\\/]dist[\\/]/,
  /[\\/]apps[\\/]guest-portal[\\/]dist[\\/]/,
  /[\\/]apps[\\/]admin-console[\\/]dist[\\/]/,
  /[\\/]\.turbo[\\/]/,
);

module.exports = withNativeWind(config, { input: './global.css' });
