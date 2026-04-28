const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Monorepo Support
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
];

// Firebase fix: Ensure Metro resolves the react-native versions of firebase packages
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.sourceExts.push("mjs");

// Enable NativeWind with CSS
module.exports = withNativeWind(config, {
    input: "./global.css",
});
