const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { withSentryConfig } = require('@sentry/react-native/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'lucide-react-native': path.resolve(__dirname, 'vendor/lucide-react-native'),
};

module.exports = withSentryConfig(
  withNativeWind(config, {
    input: './global.css',
  }),
);
