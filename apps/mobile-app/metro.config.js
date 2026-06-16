/* eslint-env node */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// On Windows, Metro's FallbackWatcher exhausts file-handle limits scanning
// the thousands of subdirectories inside node_modules/next. Block web-only
// packages and other workspace apps so Metro never watches them.
const webOnlyBlockList = [
  /[/\\]node_modules[/\\]next[/\\]/,
  /[/\\]node_modules[/\\]webpack[/\\]/,
  /[/\\]node_modules[/\\]@next[/\\]/,
  /[/\\]node_modules[/\\]eslint-config-next[/\\]/,
  /[/\\]apps[/\\]guest-portal[/\\]/,
  /[/\\]apps[/\\]partner-dashboard[/\\]/,
  /[/\\]apps[/\\]admin-console[/\\]/,
  /[/\\]apps[/\\]api-gateway[/\\]/,
  /[/\\]apps[/\\]scanner-app[/\\]/,
  /[/\\]apps[/\\]mobile-app-backup[/\\]/,
];

const existingBlockList = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existingBlockList)
  ? [...existingBlockList, ...webOnlyBlockList]
  : existingBlockList instanceof RegExp
    ? [existingBlockList, ...webOnlyBlockList]
    : webOnlyBlockList;

config.resolver.unstable_enablePackageExports = false;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'lucide-react-native': path.resolve(__dirname, 'vendor/lucide-react-native'),
};

// Apply NativeWind first — it may set its own resolveRequest.
// Our web interceptor is chained after so it takes priority.
const finalConfig = withNativeWind(config, { input: './global.css' });

// react-native-maps uses codegenNativeComponent which doesn't exist in RN Web.
// Redirect to a no-op stub for web builds only — native is unaffected.
// Catch both bare specifier AND any subpath/Source file imports by checking startsWith.
const nativeWindResolveRequest = finalConfig.resolver.resolveRequest;
finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('react-native-maps') && platform !== 'ios' && platform !== 'android') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'vendor/react-native-maps-web.js'),
    };
  }
  if (nativeWindResolveRequest) {
    return nativeWindResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = finalConfig;
