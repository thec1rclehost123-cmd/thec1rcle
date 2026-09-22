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

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'vendor/react-native-maps-web.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withSentryConfig(
  withNativeWind(config, {
    input: './global.css',
  }),
);
