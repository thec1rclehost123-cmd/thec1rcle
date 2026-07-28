const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { withSentryConfig } = require('@sentry/react-native/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Expo Router 55 and its Radix dependencies publish required conditional
// subpath exports (for example @radix-ui/primitive/is-development). Disabling
// package exports makes those native bundles unresolvable.
config.resolver.unstable_enablePackageExports = true;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'lucide-react-native': path.resolve(__dirname, 'vendor/lucide-react-native'),
};

module.exports = withSentryConfig(
  withNativeWind(config, {
    input: './global.css',
  }),
);
